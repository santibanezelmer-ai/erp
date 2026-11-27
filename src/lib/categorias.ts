/**
 * Nombre visible de una categoría jerárquica: "Maquillajes > Delineadores" → "Delineadores".
 * Solo cambia lo que se muestra; el filtro sigue usando el valor completo.
 */
export function etiquetaCategoria(categoria: string | null | undefined): string {
  if (!categoria) return "";
  const partes = categoria.split(">").map((p) => p.trim()).filter(Boolean);
  return partes[partes.length - 1] || categoria;
}
