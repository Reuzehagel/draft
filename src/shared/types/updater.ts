export type UpdateStatus =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "downloading"; progress: number }
  | { status: "ready"; version: string }
  | { status: "error"; message: string };
