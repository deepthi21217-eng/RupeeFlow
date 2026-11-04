import { supabase } from '@/lib/supabase';

export async function recordStatementUpload(details: { fileName: string; fileType: 'csv' | 'excel'; fileSizeBytes: number; importedCount: number; skippedCount: number; duplicateCount: number }): Promise<void> {
  const { error } = await supabase.from('statement_uploads').insert({ file_name: details.fileName, file_type: details.fileType, file_size_bytes: details.fileSizeBytes, imported_count: details.importedCount, skipped_count: details.skippedCount, duplicate_count: details.duplicateCount });
  if (error) throw error;
}
