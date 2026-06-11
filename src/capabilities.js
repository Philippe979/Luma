export const capabilityRegistry = [
  {
    id: "file.read_text",
    name: "Read Text",
    description: "Read plain text and Markdown files from chat attachments.",
    category: "file",
    inputs: ["text/plain", "text/markdown"],
    outputs: ["text", "metadata"],
    environments: ["cloud", "local"],
    state: "available",
    permissions: ["file_read"],
    cost: "local",
    adapter: "native_text_reader"
  },
  {
    id: "file.read_csv",
    name: "Read CSV",
    description: "Parse CSV tables and expose rows, columns, and table summaries.",
    category: "file",
    inputs: ["text/csv"],
    outputs: ["table", "summary", "metadata"],
    environments: ["cloud", "local"],
    state: "available",
    permissions: ["file_read"],
    cost: "local",
    adapter: "papaparse_or_csv_parse"
  },
  {
    id: "file.read_docx",
    name: "Read DOCX",
    description: "Extract raw text and structure from Word documents.",
    category: "file",
    inputs: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    outputs: ["text", "metadata"],
    environments: ["cloud"],
    state: "available",
    permissions: ["file_read"],
    cost: "local",
    adapter: "mammoth"
  },
  {
    id: "file.read_pdf",
    name: "Read PDF",
    description: "Extract text and page metadata from PDF files.",
    category: "file",
    inputs: ["application/pdf"],
    outputs: ["text", "pages", "metadata"],
    environments: ["cloud"],
    state: "available",
    permissions: ["file_read"],
    cost: "local",
    adapter: "pdfjs_or_pdf_parse"
  },
  {
    id: "code.read_file",
    name: "Read Code File",
    description: "Read source files as structured code context without executing them.",
    category: "code",
    inputs: ["text/javascript", "text/x-python", "text/html", "text/css", "application/json"],
    outputs: ["code", "language", "metadata"],
    environments: ["cloud", "local"],
    state: "available",
    permissions: ["file_read"],
    cost: "local",
    adapter: "native_code_reader"
  },
  {
    id: "image.ocr_basic",
    name: "Basic Image OCR",
    description: "Extract visible text from image attachments.",
    category: "image",
    inputs: ["image/png", "image/jpeg", "image/webp"],
    outputs: ["text", "metadata"],
    environments: ["local", "cloud"],
    state: "planned",
    permissions: ["file_read"],
    cost: "local",
    adapter: "tesseract_or_external_ocr"
  },
  {
    id: "memory.profile_prompt",
    name: "Profile Memory Prompt",
    description: "Inject high-confidence communication preferences without retrieving raw historical memory.",
    category: "memory",
    inputs: ["profile_memory"],
    outputs: ["tone_reference"],
    environments: ["cloud"],
    state: "available",
    permissions: ["memory_read"],
    cost: "local",
    adapter: "profile_memory"
  },
  {
    id: "memory.rag_search",
    name: "Scoped RAG Search",
    description: "Retrieve only allowed active memory for the current session, project, or workflow.",
    category: "memory",
    inputs: ["query", "scope"],
    outputs: ["memory_chunks"],
    environments: ["cloud"],
    state: "planned",
    permissions: ["memory_read"],
    cost: "low",
    adapter: "rag_adapter"
  },
  {
    id: "workflow.cluster_memory",
    name: "Workflow Cluster Memory",
    description: "Store workflow and environment cluster skeletons for future adaptive planning.",
    category: "workflow",
    inputs: ["workflow_record", "environment_signal"],
    outputs: ["workflow_cluster", "environment_cluster"],
    environments: ["cloud"],
    state: "planned",
    permissions: ["memory_read", "memory_write"],
    cost: "low",
    adapter: "cluster_memory_skeleton"
  },
  {
    id: "workflow.record",
    name: "Workflow Recorder",
    description: "Record visible workflow state for user inspection and Qwen learning.",
    category: "workflow",
    inputs: ["workflow_step"],
    outputs: ["workflow_state"],
    environments: ["cloud", "local"],
    state: "available",
    permissions: [],
    cost: "local",
    adapter: "process_trace"
  }
];

export function capabilitySummary() {
  const counts = capabilityRegistry.reduce((memo, capability) => {
    memo[capability.state] = (memo[capability.state] || 0) + 1;
    return memo;
  }, {});
  return {
    total: capabilityRegistry.length,
    available: counts.available || 0,
    planned: counts.planned || 0,
    capabilities: capabilityRegistry
  };
}
