import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/vue";
import AnalysisForm from "../src/components/submission/AnalysisForm.vue";
import ModeSelector from "../src/components/submission/ModeSelector.vue";
import ResultsView from "../src/components/results/ResultsView.vue";
import { api } from "../src/api.js";
import { inspectSequenceInput } from "../src/features/submission/sequenceInput.js";
import { normalizePublicResult } from "../src/features/results/index.js";
import { stagesForMode } from "../src/science.js";
import fixture from "./fixtures/metagenomic.json";
import fastq from "./fixtures/metagenomic.fastq?raw";
const service = { state: "online", modes: ["metagenomic"] };
const limits = { maxRecords: 1, maxRecordBases: 1, maxBases: 1000, maxRequestBytes: 2000 };
const inspect = (text, extra = {}) => inspectSequenceInput(text, { mode: "metagenomic", ...extra });
afterEach(() => vi.restoreAllMocks());

describe("MCAAT read-pool workflow", () => {
  it("advertises the read workflow only when installed and uses the MCAAT stage", async () => {
    const view = render(ModeSelector, { props: { service: { state: "online", modes: [] } } });
    expect(
      screen.queryByRole("link", { name: "Find CRISPR groups in reads" }),
    ).not.toBeInTheDocument();
    await view.rerender({ service });
    expect(screen.getByRole("link", { name: "Find CRISPR groups in reads" })).toHaveAttribute(
      "href",
      "?method=metagenomic",
    );
    expect(stagesForMode("metagenomic").map((stage) => stage.id)).toEqual([
      "queued",
      "validate_input",
      "mcaat",
      "package_results",
    ]);
    expect(stagesForMode("detection").some((stage) => stage.id === "mcaat")).toBe(false);
  });
  it("submits complete FASTQ with qualities and applies read-specific limits", async () => {
    const submit = vi
      .spyOn(api, "submit")
      .mockResolvedValue({ job_id: "d".repeat(32), access_token: "a".repeat(43) });
    const view = render(AnalysisForm, { props: { initialMode: "metagenomic", service, limits } });
    const input = screen.getByLabelText("Single-end DNA reads");
    const button = screen.getByRole("button", { name: "Compute", exact: true });
    expect(screen.queryByText("Analysis options")).not.toBeInTheDocument();
    await fireEvent.update(input, ">contig\n" + "ACGT".repeat(8));
    expect(button).toBeDisabled();
    await fireEvent.update(input, fastq);
    expect(button).toBeEnabled();
    await fireEvent.click(button);
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "metagenomic",
        sequence: fastq,
        filename: "pasted-reads.fastq",
      }),
    );
    await view.rerender({ limits: { ...limits, maxBases: 30 } });
    expect(button).toBeDisabled();
  });
  it.each([
    ["quality length", fastq.replace("I".repeat(32), "I".repeat(31))],
    ["quality control", fastq.replace("I".repeat(32), " " + "I".repeat(31))],
    ["duplicate identifier", fastq.replace("@read2", "@read1")],
    ["RNA input", fastq.replace("ACGT", "ACGU")],
    ["short read", "@r\nACGT\n+\nIIII\n"],
    ["multiline sequence", fastq.replace("ACGTACGT", "ACGT\nACGT")],
    ["mismatched header", fastq.replace("\n+\n", "\n+another\n")],
    ["empty header", fastq.replace("@read1", "@")],
    ["sequence JSON", '{"schema":{"name":"crisprloci.sequence-set"}}'],
  ])("rejects %s", (_, text) => expect(inspect(text).valid).toBe(false));
  it("accepts CRLF, repeated full headers and lowercase DNA while preserving raw submission", () => {
    expect(inspect(fastq.replaceAll("\n", "\r\n")).valid).toBe(true);
    expect(inspect(fastq.replace("\n+\n", "\n+read1\n")).valid).toBe(true);
    expect(inspect(fastq.replace("ACGT", "acgt")).valid).toBe(true);
    expect(inspect(fastq, { maxHeaderCharacters: 3 }).valid).toBe(false);
  });
  it("keeps read evidence separate from source arrays and shows exact report sequences", async () => {
    render(ResultsView, { props: { job: structuredClone(fixture) } });
    expect(screen.queryByRole("tab", { name: "Arrays", exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "History", exact: true })).not.toBeInTheDocument();
    await fireEvent.click(screen.getByRole("tab", { name: "Read groups", exact: true }));
    const panel = within(screen.getByRole("tabpanel", { name: "Read groups", exact: true }));
    expect(
      panel.getByText(/array order, orientation and evolutionary history are not inferred/),
    ).toBeInTheDocument();
    expect(panel.getByText(/quality filtering is not performed/)).toBeInTheDocument();
    expect(
      panel.getByRole("table", { name: "Repeat variants and spacers for Array_1" }),
    ).toBeInTheDocument();
    expect(
      panel.getByText(fixture.summary.metagenomic.groups[0].spacers[0].sequence),
    ).toBeInTheDocument();
  });
  it("distinguishes zero groups, truncated preview and unavailable evidence", async () => {
    const job = structuredClone(fixture);
    job.summary.metagenomic.groups = [];
    job.summary.metagenomic.groups_truncated = true;
    const view = render(ResultsView, { props: { job } });
    expect(screen.getByRole("tabpanel", { name: "Overview", exact: true })).toHaveTextContent(
      "No groups are included in this preview",
    );
    job.summary.metagenomic.counts.groups = 0;
    await view.rerender({ job: structuredClone(job) });
    expect(screen.getByRole("tabpanel", { name: "Overview", exact: true })).toHaveTextContent(
      "MCAAT reported no repeat and spacer groups",
    );
    job.summary.metagenomic = null;
    await view.rerender({ job: structuredClone(job) });
    expect(screen.getByRole("tabpanel", { name: "Overview", exact: true })).toHaveTextContent(
      "Completed metagenomic CRISPR evidence is unavailable",
    );
  });
  it("bounds previews and preserves missing values", () => {
    const report = structuredClone(fixture.summary.metagenomic);
    report.counts.groups = false;
    report.groups = Array.from({ length: 51 }, () => ({
      consensus_repeat: "bad",
      spacers: Array.from({ length: 51 }, () => ({ sequence: null })),
    }));
    const normalized = normalizePublicResult({ metagenomic: report }).metagenomic;
    expect(normalized.counts.groups).toBeNull();
    expect(normalized.groups).toHaveLength(50);
    expect(normalized.groups[0].spacers).toHaveLength(50);
    expect(normalized.groups[0].consensusRepeat).toBeNull();
    expect(normalized.groups[0].spacers[0].sequence).toBeNull();
    expect(normalized.truncated).toBe(true);
  });
});
