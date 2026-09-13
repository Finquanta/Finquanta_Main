/**
 * The CSV zip.
 *
 * CSV downloads as an archive containing a clean `ledger.csv` and a separate
 * `cover.txt`, rather than a single CSV with the business details above the
 * column row. A header block inside the CSV breaks every importer — the column
 * row would no longer be the first line — and importability is the entire
 * reason for offering CSV alongside XLSX.
 */
import JSZip from 'jszip';

export async function zipCsv(
  csvName: string,
  csv: Buffer,
  cover: Buffer
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(csvName, csv);
  zip.file('cover.txt', cover);
  // DEFLATE at a middling level: text compresses hard and the files are small,
  // so the extra CPU of level 9 buys almost nothing.
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
