// src/utils/formatDate.ts
export function formatDateDDMMYYYY(value?: string | null): string {
  if (!value) return '';

  const d = new Date(value);
  if (isNaN(d.getTime())) {
    // If it's not a valid date string, just return the original so nothing blows up
    return String(value);
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0'); // months 0–11
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}
