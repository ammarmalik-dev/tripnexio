/**
 * Kept as a re-export so existing imports keep working — the one shared
 * implementation (Business Rules §14 "Sensitive Admin Actions" extra
 * confirmation step, plus the `useConfirmAction()` hook) lives in
 * src/components/ui/ConfirmActionDialog.tsx.
 */
export { ConfirmActionDialog, useConfirmAction } from "@/components/ui/ConfirmActionDialog";
export type { ConfirmActionDialogProps, ConfirmActionOptions } from "@/components/ui/ConfirmActionDialog";
