"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Package,
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  Barcode,
  Camera,
  Layers,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  FileSpreadsheet,
  Upload,
  Download,
  Printer,
  Tag,
  FolderPlus,
  Folder,
  CheckSquare,
  Square,
  Filter,
  Sparkles,
  UploadCloud,
  ImageIcon,
  DollarSign,
  TrendingUp,
  Box,
  RefreshCw,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import {
  exportarProductosAExcel,
  descargarPlantillaProductos,
  parsearProductosDesdeArchivo,
  type ProductoImportRow,
} from "@/lib/excel";
import { imprimirHojaEtiquetas } from "@/lib/barcode-labels";

type Producto = Database["public"]["Tables"]["productos"]["Row"];
type Variante = Database["public"]["Tables"]["producto_variantes"]["Row"];

export default function ProductosPage() {
  const { negocio, sucursalActiva } = useTenant();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroStock, setFiltroStock] = useState<"todos" | "bajo" | "agotado">("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<string[]>([]);

  // Selección múltiple para acciones masivas
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalAsignarMasivoOpen, setModalAsignarMasivoOpen] = useState(false);
  const [catMasiva, setCatMasiva] = useState("");
  const [guardandoCatMasiva, setGuardandoCatMasiva] = useState(false);

  // Asignación rápida individual de categoría
  const [asignarCatProd, setAsignarCatProd] = useState<Producto | null>(null);
  const [catRapida, setCatRapida] = useState("");
  const [guardandoCatRapida, setGuardandoCatRapida] = useState(false);

  // Barcode Scanner Modal
  const [scannerOpen, setScannerOpen] = useState(false);

  // Modal Ver Variantes de Producto
  const [variantesModalProd, setVariantesModalProd] = useState<Producto | null>(null);

  // Modal Etiquetas Código de Barras
  const [modalEtiquetasOpen, setModalEtiquetasOpen] = useState(false);
  const [productoParaEtiqueta, setProductoParaEtiqueta] = useState<Producto | null>(null);
  const [cantidadEtiquetas, setCantidadEtiquetas] = useState<number>(12);

  // Modal Importar Excel
  const [modalImportOpen, setModalImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [productosImportados, setProductosImportados] = useState<ProductoImportRow[]>([]);

  // Modal Crear / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productoEdit, setProductoEdit] = useState<Producto | null>(null);

  // Form states
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [codigo, setCodigo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [imagenUrl, setImagenUrl] = useState("");
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [precioVenta, setPrecioVenta] = useState<string>("0");
  const [precioCosto, setPrecioCosto] = useState<string>("0");
  const [stock, setStock] = useState<string>("0");
  const [stockMin, setStockMin] = useState<string>("5");
  const [sinControlStock, setSinControlStock] = useState(false);
  const [activo, setActivo] = useState(true);

  // Modal Ajuste Rápido
  const [ajusteModalOpen, setAjusteModalOpen] = useState(false);
  const [productoAjuste, setProductoAjuste] = useState<Producto | null>(null);
  const [cantidadAjuste, setCantidadAjuste] = useState<string>("0");
  const [tipoAjuste, setTipoAjuste] = useState<"agregar" | "reducir">("agregar");
  const [savingAjuste, setSavingAjuste] = useState(false);

  const fetchProductos = async () => {
    if (!negocio?.id) return;
    setLoading(true);
    const supabase = createClient();

    try {
      const [prodsRes, varsRes, catsRes] = await Promise.all([
        supabase
          .from("productos")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("nombre", { ascending: true }),
        supabase
          .from("producto_variantes")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("nombre", { ascending: true }),
        supabase
          .from("categorias")
          .select("nombre")
          .eq("negocio_id", negocio.id)
          .eq("activa", true)
          .order("nombre", { ascending: true }),
      ]);

      if (prodsRes.error) throw prodsRes.error;

      const prodsList = prodsRes.data || [];
      setProductos(prodsList);
      setVariantes(varsRes.data || []);

      // Extraer categorías únicas de la tabla categorias y de los productos
      const dbCats = (catsRes.data || []).map((c) => c.nombre.trim()).filter(Boolean);
      const prodsCats = prodsList
        .map((p) => p.categoria?.trim())
        .filter(Boolean) as string[];

      const allUnique = Array.from(new Set([...dbCats, ...prodsCats])).sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" })
      );
      setCategoriasDisponibles(allUnique);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  // Asignar categoría a un solo producto
  const aplicarCategoriaAProducto = async (productoId: string, nuevaCategoria: string | null) => {
    if (!negocio?.id) return;
    const catTrim = nuevaCategoria?.trim() || null;
    const supabase = createClient();
    setGuardandoCatRapida(true);
    try {
      const { error } = await supabase
        .from("productos")
        .update({
          categoria: catTrim,
          categorias: catTrim ? [catTrim] : [],
        })
        .eq("id", productoId);

      if (error) throw error;

      // Si es nueva categoría no vacía, asegurar que esté en la tabla categorias
      if (catTrim) {
        await supabase.from("categorias").upsert(
          { negocio_id: negocio.id, nombre: catTrim, activa: true },
          { onConflict: "negocio_id,nombre" }
        );
        setCategoriasDisponibles((prev) =>
          Array.from(new Set([...prev, catTrim])).sort((a, b) =>
            a.localeCompare(b, "es", { sensitivity: "base" })
          )
        );
      }

      setProductos((prev) =>
        prev.map((p) =>
          p.id === productoId
            ? { ...p, categoria: catTrim, categorias: catTrim ? [catTrim] : [] }
            : p
        )
      );

      toast.success(catTrim ? `Categoría "${catTrim}" asignada` : "Categoría removida");
      setAsignarCatProd(null);
    } catch (err: any) {
      toast.error(err.message || "Error al asignar categoría");
    } finally {
      setGuardandoCatRapida(false);
    }
  };

  // Asignar categoría masivamente a varios productos
  const aplicarCategoriaMasiva = async (nuevaCategoria: string | null) => {
    if (!negocio?.id || selectedIds.size === 0) return;
    const catTrim = nuevaCategoria?.trim() || null;
    const idsArray = Array.from(selectedIds);
    const supabase = createClient();
    setGuardandoCatMasiva(true);
    try {
      const { error } = await supabase
        .from("productos")
        .update({
          categoria: catTrim,
          categorias: catTrim ? [catTrim] : [],
        })
        .in("id", idsArray);

      if (error) throw error;

      if (catTrim) {
        await supabase.from("categorias").upsert(
          { negocio_id: negocio.id, nombre: catTrim, activa: true },
          { onConflict: "negocio_id,nombre" }
        );
        setCategoriasDisponibles((prev) =>
          Array.from(new Set([...prev, catTrim])).sort((a, b) =>
            a.localeCompare(b, "es", { sensitivity: "base" })
          )
        );
      }

      setProductos((prev) =>
        prev.map((p) =>
          selectedIds.has(p.id)
            ? { ...p, categoria: catTrim, categorias: catTrim ? [catTrim] : [] }
            : p
        )
      );

      toast.success(
        catTrim
          ? `Categoría "${catTrim}" asignada a ${idsArray.length} productos`
          : `Categoría removida de ${idsArray.length} productos`
      );
      setSelectedIds(new Set());
      setModalAsignarMasivoOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Error al asignar categoría en lote");
    } finally {
      setGuardandoCatMasiva(false);
    }
  };

  useEffect(() => {
    fetchProductos();
  }, [negocio?.id]);

  const variantsOf = (prodId: string): Variante[] => {
    return variantes.filter((v) => v.producto_id === prodId);
  };

  const abrirCrear = () => {
    setProductoEdit(null);
    setNombre("");
    setDescripcion("");
    setCodigo("");
    setCategoria("");
    setImagenUrl("");
    setPrecioVenta("0");
    setPrecioCosto("0");
    setStock("0");
    setStockMin("5");
    setSinControlStock(false);
    setActivo(true);
    setModalOpen(true);
  };

  const abrirEditar = (prod: Producto) => {
    setProductoEdit(prod);
    setNombre(prod.nombre || "");
    setDescripcion((prod as any).descripcion || "");
    setCodigo(prod.codigo || "");
    setCategoria(prod.categoria || "");
    setImagenUrl(prod.imagen_url || "");
    setPrecioVenta(String(prod.precio_venta || 0));
    setPrecioCosto(String(prod.precio_costo || 0));
    setStock(String(prod.stock || 0));
    setStockMin(String(prod.stock_min || 5));
    setSinControlStock(prod.sin_control_stock || false);
    setActivo(prod.activo);
    setModalOpen(true);
  };

  const generarCodigoBarras = () => {
    const randomCode =
      "780" +
      Math.floor(1000000000 + Math.random() * 9000000000)
        .toString()
        .slice(0, 9);
    setCodigo(randomCode);
    toast.info(`Código EAN generado: ${randomCode}`);
  };

  const handleSubirImagen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !negocio?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen debe pesar menos de 5 MB");
      return;
    }

    setSubiendoImagen(true);
    const supabase = createClient();
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${negocio.id}/productos/prod-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("producto-imgs")
        .upload(filePath, file, {
          upsert: true,
          cacheControl: "3600",
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: pubData } = supabase.storage
        .from("producto-imgs")
        .getPublicUrl(filePath);

      setImagenUrl(pubData.publicUrl);
      toast.success("Foto del producto subida exitosamente");
    } catch (err: any) {
      console.error("Error al subir foto:", err);
      toast.error(err.message || "Error al subir la imagen");
    } finally {
      setSubiendoImagen(false);
      e.target.value = "";
    }
  };

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio?.id) return;

    if (!nombre.trim()) {
      toast.error("El nombre del producto es obligatorio");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    try {
      const catTrim = categoria.trim() || null;
      const payload: any = {
        negocio_id: negocio.id,
        sucursal_id: sucursalActiva?.id || null,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        codigo: codigo.trim() || null,
        categoria: catTrim,
        categorias: catTrim ? [catTrim] : [],
        imagen_url: imagenUrl.trim() || null,
        precio_venta: Number(precioVenta) || 0,
        precio_costo: Number(precioCosto) || 0,
        stock: sinControlStock ? 0 : Number(stock) || 0,
        stock_min: Number(stockMin) || 0,
        sin_control_stock: sinControlStock,
        activo: activo,
      };

      if (productoEdit?.id) {
        // Actualizar
        const { error } = await supabase
          .from("productos")
          .update(payload)
          .eq("id", productoEdit.id);

        if (error) throw error;
        toast.success("Producto actualizado correctamente");
      } else {
        // Crear
        const { error } = await supabase.from("productos").insert(payload);
        if (error) throw error;
        toast.success("Producto creado con éxito");
      }

      // Si se definió categoría, asegurar persistencia en tabla categorias
      if (catTrim) {
        await supabase.from("categorias").upsert(
          { negocio_id: negocio.id, nombre: catTrim, activa: true },
          { onConflict: "negocio_id,nombre" }
        );
        setCategoriasDisponibles((prev) =>
          Array.from(new Set([...prev, catTrim])).sort((a, b) =>
            a.localeCompare(b, "es", { sensitivity: "base" })
          )
        );
      }

      setModalOpen(false);
      fetchProductos();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el producto");
    } finally {
      setSaving(false);
    }
  };

  const eliminarProducto = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este producto?")) return;
    const supabase = createClient();
    try {
      const { error } = await supabase.from("productos").delete().eq("id", id);
      if (error) throw error;
      toast.success("Producto eliminado");
      fetchProductos();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  const abrirAjusteStock = (prod: Producto) => {
    setProductoAjuste(prod);
    setCantidadAjuste("1");
    setTipoAjuste("agregar");
    setAjusteModalOpen(true);
  };

  const guardarAjusteStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productoAjuste) return;

    const cant = Number(cantidadAjuste);
    if (isNaN(cant) || cant <= 0) {
      toast.error("Ingresa una cantidad válida");
      return;
    }

    setSavingAjuste(true);
    const supabase = createClient();

    try {
      const actual = Number(productoAjuste.stock || 0);
      const nuevoStock = tipoAjuste === "agregar" ? actual + cant : Math.max(0, actual - cant);

      const { error } = await supabase
        .from("productos")
        .update({ stock: nuevoStock })
        .eq("id", productoAjuste.id);

      if (error) throw error;
      toast.success(`Stock actualizado: ${nuevoStock} unidades`);
      setAjusteModalOpen(false);
      fetchProductos();
    } catch (err: any) {
      toast.error(err.message || "Error al ajustar stock");
    } finally {
      setSavingAjuste(false);
    }
  };

  // Filtrado
  const productosFiltrados = productos.filter((p) => {
    const q = busqueda.toLowerCase().trim();
    const matchBusqueda =
      !q ||
      p.nombre.toLowerCase().includes(q) ||
      (p.codigo && p.codigo.toLowerCase().includes(q)) ||
      (p.categoria && p.categoria.toLowerCase().includes(q));

    if (!matchBusqueda) return false;

    if (filtroStock === "bajo") {
      return !p.sin_control_stock && (p.stock || 0) <= (p.stock_min || 5) && (p.stock || 0) > 0;
    }
    if (filtroStock === "agotado") {
      return !p.sin_control_stock && (p.stock || 0) <= 0;
    }

    // Filtro por categoría
    if (filtroCategoria === "sin_categoria") {
      if (p.categoria && p.categoria.trim().length > 0) return false;
    } else if (filtroCategoria !== "todas") {
      if (p.categoria !== filtroCategoria) return false;
    }

    return true;
  });

  const totalSinCategoria = productos.filter(
    (p) => !p.categoria || !p.categoria.trim()
  ).length;

  // Exportación a Excel
  const handleExportarExcel = () => {
    if (productosFiltrados.length === 0) {
      toast.info("No hay productos para exportar");
      return;
    }
    exportarProductosAExcel(productosFiltrados, negocio?.nombre || "Operix");
    toast.success("Catálogo exportado a Excel exitosamente");
  };

  // Procesar archivo seleccionado para importar
  const handleArchivoExcelSeleccionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rows = await parsearProductosDesdeArchivo(file);
      if (rows.length === 0) {
        toast.error("No se detectaron productos válidos en el archivo.");
        return;
      }
      setProductosImportados(rows);
      toast.info(`Se detectaron ${rows.length} productos listos para importar.`);
    } catch (err: any) {
      toast.error(err.message || "Error al procesar el archivo Excel");
    } finally {
      e.target.value = "";
    }
  };

  // Guardar masivamente en Supabase
  const handleConfirmarImportacion = async () => {
    if (!negocio?.id || productosImportados.length === 0) return;
    setImporting(true);
    const supabase = createClient();

    try {
      const payload = productosImportados.map((p) => ({
        negocio_id: negocio.id,
        nombre: p.nombre,
        codigo: p.codigo || null,
        categoria: p.categoria || null,
        precio_venta: p.precio_venta,
        precio_costo: p.precio_costo || 0,
        stock: p.stock || 0,
        stock_min: p.stock_minimo || 5,
        descripcion: p.descripcion || null,
        activo: true,
      }));

      // Inserción en bloques de 50
      const batchSize = 50;
      for (let i = 0; i < payload.length; i += batchSize) {
        const batch = payload.slice(i, i + batchSize);
        const { error } = await supabase.from("productos").insert(batch);
        if (error) throw error;
      }

      toast.success(`¡${productosImportados.length} productos importados correctamente!`);
      setModalImportOpen(false);
      setProductosImportados([]);
      fetchProductos();
    } catch (err: any) {
      toast.error(err.message || "Error al importar productos en la base de datos");
    } finally {
      setImporting(false);
    }
  };

  // Impresión de Etiquetas
  const abrirModalEtiqueta = (prod: Producto) => {
    const cod = prod.codigo || prod.codigo_interno;
    if (!cod) {
      toast.error("Este producto no tiene código de barras registrado");
      return;
    }
    setProductoParaEtiqueta(prod);
    setCantidadEtiquetas(12);
    setModalEtiquetasOpen(true);
  };

  const ejecutarImpresionEtiquetas = () => {
    if (!productoParaEtiqueta) return;
    const cod = productoParaEtiqueta.codigo || productoParaEtiqueta.codigo_interno || "";
    imprimirHojaEtiquetas(
      [
        {
          nombre: productoParaEtiqueta.nombre,
          codigo: cod,
          precio: Number(productoParaEtiqueta.precio_venta || 0),
          cantidad: cantidadEtiquetas,
        },
      ],
      negocio?.nombre || "Operix"
    );
    setModalEtiquetasOpen(false);
    toast.success(`Generando hoja con ${cantidadEtiquetas} etiquetas...`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo de Productos</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona precios, inventario y códigos de barra ({productos.length} productos registrados)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportarExcel}
            className="gap-1.5 text-xs font-semibold flex-1 sm:flex-initial justify-center"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span className="hidden sm:inline">Exportar Excel</span>
            <span className="sm:hidden">Exportar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalImportOpen(true)}
            className="gap-1.5 text-xs font-semibold flex-1 sm:flex-initial justify-center"
          >
            <Upload className="h-4 w-4 text-blue-600" />
            <span className="hidden sm:inline">Importar Excel</span>
            <span className="sm:hidden">Importar</span>
          </Button>

          <Button onClick={abrirCrear} size="sm" className="gap-2 shadow-sm font-semibold w-full sm:w-auto justify-center">
            <Plus className="h-4 w-4" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, código o categoría..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          {/* Filtro por Categoría */}
          <div className="w-full sm:w-auto">
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className={cn(
                "h-9 w-full sm:w-auto rounded-md border px-3 text-xs font-semibold bg-background transition-colors focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer",
                filtroCategoria === "sin_categoria"
                  ? "border-amber-500 text-amber-700 bg-amber-50/70 dark:bg-amber-950/30 dark:text-amber-300"
                  : filtroCategoria !== "todas"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border text-foreground hover:bg-muted"
              )}
            >
              <option value="todas">📂 Todas las categorías ({productos.length})</option>
              {totalSinCategoria > 0 && (
                <option value="sin_categoria">
                  ⚠️ Sin categoría ({totalSinCategoria})
                </option>
              )}
              {categoriasDisponibles.map((cat) => {
                const count = productos.filter((p) => p.categoria === cat).length;
                return (
                  <option key={cat} value={cat}>
                    📁 {cat} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setFiltroStock("todos")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              filtroStock === "todos"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:bg-muted text-muted-foreground"
            )}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setFiltroStock("bajo")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              filtroStock === "bajo"
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-background border-border hover:bg-muted text-muted-foreground"
            )}
          >
            Stock Bajo
          </button>
          <button
            type="button"
            onClick={() => setFiltroStock("agotado")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              filtroStock === "agotado"
                ? "bg-destructive text-destructive-foreground border-destructive"
                : "bg-background border-border hover:bg-muted text-muted-foreground"
            )}
          >
            Agotados
          </button>
        </div>
      </div>

      {/* Barra de Acciones Masivas cuando hay productos seleccionados */}
      {selectedIds.size > 0 && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="font-semibold text-xs text-foreground">
              {selectedIds.size} {selectedIds.size === 1 ? "producto seleccionado" : "productos seleccionados"}
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-muted-foreground hover:underline ml-2"
            >
              Deseleccionar todos
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setCatMasiva("");
                setModalAsignarMasivoOpen(true);
              }}
              className="gap-1.5 text-xs font-semibold h-8 bg-primary text-primary-foreground"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Asignar Categoría a {selectedIds.size}
            </Button>
          </div>
        </div>
      )}

      {/* Table view */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">Cargando inventario...</span>
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {busqueda || filtroCategoria !== "todas"
                ? "No se encontraron productos con los filtros aplicados."
                : "Aún no tienes productos registrados. Haz clic en 'Nuevo Producto' para comenzar."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          productosFiltrados.length > 0 &&
                          productosFiltrados.every((p) => selectedIds.has(p.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(
                              new Set(productosFiltrados.map((p) => p.id))
                            );
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                        title="Seleccionar todos los visibles"
                      />
                    </th>
                    <th className="py-3 px-3">Producto</th>
                    <th className="py-3 px-3 hidden md:table-cell">Código</th>
                    <th className="py-3 px-3 hidden sm:table-cell">Categoría</th>
                    <th className="py-3 px-3 text-right">Precio</th>
                    <th className="py-3 px-3 text-right hidden sm:table-cell">Costo</th>
                    <th className="py-3 px-3 text-center">Stock</th>
                    <th className="py-3 px-3 text-center hidden lg:table-cell">Estado</th>
                    <th className="py-3 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {productosFiltrados.map((prod) => {
                    const vs = variantsOf(prod.id);
                    const st = vs.length > 0
                      ? vs.reduce((s, v) => s + Number(v.stock || 0), 0)
                      : Number(prod.stock || 0);
                    const stMin = Number(prod.stock_min || 5);
                    const isBajo = !prod.sin_control_stock && st <= stMin && st > 0;
                    const isAgotado = !prod.sin_control_stock && st <= 0;
                    const isSelected = selectedIds.has(prod.id);

                    return (
                      <tr
                        key={prod.id}
                        className={cn(
                          "transition-colors",
                          isSelected ? "bg-primary/5" : "hover:bg-muted/30"
                        )}
                      >
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) {
                                  next.add(prod.id);
                                } else {
                                  next.delete(prod.id);
                                }
                                return next;
                              });
                            }}
                            className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-muted border overflow-hidden shrink-0 flex items-center justify-center">
                              {prod.imagen_url ? (
                                <img
                                  src={prod.imagen_url}
                                  alt={prod.nombre}
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/40" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div
                                className="font-semibold text-foreground truncate max-w-[140px] sm:max-w-xs text-xs sm:text-sm"
                                title={prod.nombre}
                              >
                                {prod.nombre}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                {prod.categoria && (
                                  <span className="sm:hidden text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded truncate max-w-[100px]">
                                    {prod.categoria}
                                  </span>
                                )}
                                {vs.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setVariantesModalProd(prod)}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                                  >
                                    <Layers className="h-3 w-3" />
                                    <span>{vs.length} var.</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 hidden md:table-cell">
                          {prod.codigo ? (
                            <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                              <Barcode className="h-3 w-3" />
                              {prod.codigo}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 hidden sm:table-cell">
                          {prod.categoria ? (
                            <button
                              type="button"
                              onClick={() => {
                                setAsignarCatProd(prod);
                                setCatRapida(prod.categoria || "");
                              }}
                              className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-muted/80 hover:bg-muted font-medium text-foreground border border-border/60 hover:border-border transition-all cursor-pointer"
                              title="Haz clic para cambiar o quitar la categoría"
                            >
                              <Folder className="h-3 w-3 text-primary/70" />
                              <span className="truncate max-w-[130px]">{prod.categoria}</span>
                              <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setAsignarCatProd(prod);
                                setCatRapida("");
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition-all cursor-pointer shadow-2xs"
                              title="Asignar categoría a este producto"
                            >
                              <FolderPlus className="h-3.5 w-3.5" />
                              <span>+ Asignar</span>
                            </button>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-foreground text-xs sm:text-sm">
                          {formatMoney(prod.precio_venta)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs text-muted-foreground hidden sm:table-cell">
                          {formatMoney(prod.precio_costo)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {prod.sin_control_stock ? (
                            <span className="text-xs text-muted-foreground italic">Ilimitado</span>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "font-bold text-xs px-2 py-0.5 rounded-full",
                                  isAgotado
                                    ? "bg-destructive/10 text-destructive"
                                    : isBajo
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-500"
                                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500"
                                )}
                              >
                                {st} u.
                              </span>
                              <button
                                onClick={() => abrirAjusteStock(prod)}
                                title="Ajustar stock"
                                className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                <ArrowUpDown className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center hidden lg:table-cell">
                          {prod.activo ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-500 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                              <XCircle className="h-3.5 w-3.5" />
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => abrirModalEtiqueta(prod)}
                              className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                              title="Imprimir etiquetas con código de barras"
                            >
                              <Tag className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => abrirEditar(prod)}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => eliminarProducto(prod.id)}
                              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Crear / Editar Producto — Ventana Armonizada */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden border border-border shadow-2xl">
          {/* Cabecera Armónica */}
          <div className="p-5 pb-4 border-b border-border bg-gradient-to-r from-muted/50 via-muted/30 to-background flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 overflow-hidden shadow-2xs">
                {imagenUrl ? (
                  <img
                    src={imagenUrl}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <Package className="h-6 w-6" />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground truncate">
                  {productoEdit ? productoEdit.nombre : "Nuevo Producto"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {productoEdit
                    ? "Edita los precios, inventario, imagen y clasificación comercial"
                    : "Completa los datos para dar de alta este producto en tu inventario y catálogo web"}
                </DialogDescription>
              </div>
            </div>

            {/* Switch de Visibilidad / Activo */}
            <div className="flex items-center gap-2 self-start sm:self-auto bg-card border border-border px-3 py-1.5 rounded-full shadow-2xs">
              <label
                htmlFor="prod-activo-switch"
                className="text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    activo ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"
                  )}
                />
                <span
                  className={
                    activo
                      ? "text-emerald-600 dark:text-emerald-400 font-bold"
                      : "text-muted-foreground"
                  }
                >
                  {activo ? "Visible en Catálogo y POS" : "Oculto / Desactivado"}
                </span>
              </label>
              <input
                id="prod-activo-switch"
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                disabled={saving}
              />
            </div>
          </div>

          {/* Formulario scrolleable en 2 columnas */}
          <form
            onSubmit={guardarProducto}
            className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Columna Izquierda: Información Principal & Precios (7 cols) */}
              <div className="md:col-span-7 space-y-5">
                {/* Tarjeta 1: Identificación Básica */}
                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
                    <Box className="h-3.5 w-3.5 text-primary" />
                    <span>Identificación del Producto</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prod-nombre" className="text-xs font-semibold">
                      Nombre Comercial *
                    </Label>
                    <Input
                      id="prod-nombre"
                      placeholder="Ej: Labial Hidratante Mate, Polera Oversize..."
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      required
                      disabled={saving}
                      className="font-medium text-sm h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="prod-codigo" className="text-xs font-semibold">
                        Código de Barras / SKU
                      </Label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setScannerOpen(true)}
                          className="flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                        >
                          <Camera className="h-3 w-3" />
                          Escanear
                        </button>
                        <span className="text-muted-foreground/30">•</span>
                        <button
                          type="button"
                          onClick={generarCodigoBarras}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium cursor-pointer"
                          title="Genera un código aleatorio EAN-13"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Generar
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                      <Input
                        id="prod-codigo"
                        placeholder="Escanea o escribe el código..."
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value)}
                        disabled={saving}
                        className="pl-9 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prod-desc" className="text-xs font-semibold">
                      Descripción breve (para catálogo web)
                    </Label>
                    <textarea
                      id="prod-desc"
                      rows={2}
                      placeholder="Ingresa características, modo de uso o detalles comerciales..."
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      disabled={saving}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-2xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    />
                  </div>
                </div>

                {/* Tarjeta 2: Precios, Costo & Rentabilidad en Vivo */}
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/[0.03] space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
                      <DollarSign className="h-3.5 w-3.5 text-primary" />
                      <span>Precios y Rentabilidad</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Valores netos
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-precio" className="text-xs font-semibold">
                        Precio de Venta *
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                          $
                        </span>
                        <Input
                          id="prod-precio"
                          type="number"
                          step="any"
                          value={precioVenta}
                          onChange={(e) => setPrecioVenta(e.target.value)}
                          required
                          disabled={saving}
                          className="pl-7 font-bold text-sm h-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="prod-costo" className="text-xs font-semibold">
                        Costo de Compra
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                          $
                        </span>
                        <Input
                          id="prod-costo"
                          type="number"
                          step="any"
                          value={precioCosto}
                          onChange={(e) => setPrecioCosto(e.target.value)}
                          disabled={saving}
                          className="pl-7 text-sm h-10 text-muted-foreground"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Indicador Dinámico de Ganancia y Margen */}
                  {(() => {
                    const pV = Number(precioVenta) || 0;
                    const pC = Number(precioCosto) || 0;
                    const ganancia = pV - pC;
                    const margen = pV > 0 ? (ganancia / pV) * 100 : 0;
                    const esRentable = ganancia >= 0;

                    return (
                      <div className="pt-2 border-t border-border/60">
                        <div className="p-3 rounded-lg bg-card border border-border flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                                esRentable
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-destructive/10 text-destructive"
                              )}
                            >
                              <TrendingUp className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-[11px] text-muted-foreground font-medium">
                                Margen Estimado
                              </div>
                              <div
                                className={cn(
                                  "text-sm font-bold",
                                  esRentable
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-destructive"
                                )}
                              >
                                {margen.toFixed(1)}% margen
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[11px] text-muted-foreground font-medium">
                              Ganancia x unidad
                            </div>
                            <div
                              className={cn(
                                "text-sm font-black",
                                esRentable
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-destructive"
                              )}
                            >
                              {formatMoney(ganancia)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Columna Derecha: Foto, Categoría & Stock (5 cols) */}
              <div className="md:col-span-5 space-y-5">
                {/* Tarjeta 3: Imagen del Producto */}
                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
                      <ImageIcon className="h-3.5 w-3.5 text-primary" />
                      <span>Fotografía del Producto</span>
                    </div>
                    {imagenUrl && (
                      <button
                        type="button"
                        onClick={() => setImagenUrl("")}
                        className="text-[11px] text-destructive hover:underline cursor-pointer"
                      >
                        Quitar
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3 items-center">
                    <div className="h-20 w-20 rounded-xl bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center relative group">
                      {imagenUrl ? (
                        <img
                          src={imagenUrl}
                          alt="Producto"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                      )}
                      {subiendoImagen && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-2 min-w-0">
                      <label className="inline-flex items-center justify-center gap-1.5 w-full h-8 px-3 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors cursor-pointer">
                        <UploadCloud className="h-3.5 w-3.5 text-primary" />
                        <span>{subiendoImagen ? "Subiendo..." : "Subir Foto..."}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleSubirImagen}
                          disabled={subiendoImagen || saving}
                          className="hidden"
                        />
                      </label>

                      <div className="relative">
                        <Input
                          placeholder="o pega URL de imagen..."
                          value={imagenUrl}
                          onChange={(e) => setImagenUrl(e.target.value)}
                          disabled={saving || subiendoImagen}
                          className="h-7 text-[11px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tarjeta 4: Clasificación / Categoría */}
                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
                      <Folder className="h-3.5 w-3.5 text-primary" />
                      <span>Categoría</span>
                    </div>
                    {categoria && (
                      <button
                        type="button"
                        onClick={() => setCategoria("")}
                        className="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>

                  <div className="flex gap-1.5">
                    <Input
                      id="prod-cat"
                      list="datalist-cat-modal"
                      placeholder="Escribe o selecciona..."
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      disabled={saving}
                      className="flex-1 text-xs h-9"
                    />
                    {categoriasDisponibles.length > 0 && (
                      <select
                        className="h-9 w-28 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring shrink-0 cursor-pointer"
                        value={
                          categoriasDisponibles.includes(categoria) ? categoria : ""
                        }
                        onChange={(e) => {
                          if (e.target.value) setCategoria(e.target.value);
                        }}
                        disabled={saving}
                        title="Seleccionar de la lista de categorías existentes"
                      >
                        <option value="">📂 Lista...</option>
                        {categoriasDisponibles.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <datalist id="datalist-cat-modal">
                    {categoriasDisponibles.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>

                  {/* Chips sugeridos rápidos */}
                  {categoriasDisponibles.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {categoriasDisponibles.slice(0, 4).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCategoria(c)}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer",
                            categoria === c
                              ? "bg-primary text-primary-foreground border-primary font-bold shadow-2xs"
                              : "bg-muted/60 hover:bg-muted text-foreground border-border/80"
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tarjeta 5: Control de Inventario */}
                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span>Inventario & Stock</span>
                    </div>
                  </div>

                  {/* Switch Sin control de stock */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold">
                        {sinControlStock ? "Stock Ilimitado" : "Control de Stock Activo"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {sinControlStock
                          ? "Sin conteo físico (servicios o cocina)"
                          : "Control estricto con alertas"}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={sinControlStock}
                      onChange={(e) => setSinControlStock(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary cursor-pointer"
                      disabled={saving}
                    />
                  </div>

                  {!sinControlStock && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <Label htmlFor="prod-stock" className="text-xs font-semibold">
                          Stock Actual
                        </Label>
                        <Input
                          id="prod-stock"
                          type="number"
                          value={stock}
                          onChange={(e) => setStock(e.target.value)}
                          disabled={saving}
                          className="h-9 font-semibold text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="prod-stock-min" className="text-xs font-semibold">
                          Alerta Mínimo
                        </Label>
                        <Input
                          id="prod-stock-min"
                          type="number"
                          value={stockMin}
                          onChange={(e) => setStockMin(e.target.value)}
                          disabled={saving}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Fijo con Botones */}
            <div className="pt-4 border-t border-border flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={saving || subiendoImagen}
                className="text-xs h-9 px-4"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving || subiendoImagen}
                className="text-xs font-bold h-9 px-5 bg-primary text-primary-foreground shadow-xs gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {productoEdit ? "Guardar Cambios" : "Crear Producto"}
                    </span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Ajuste Rápido de Stock */}
      <Dialog open={ajusteModalOpen} onOpenChange={setAjusteModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar Stock</DialogTitle>
            <DialogDescription>
              {productoAjuste?.nombre} (Actual: {productoAjuste?.stock || 0} u.)
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={guardarAjusteStock} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipoAjuste("agregar")}
                className={cn(
                  "py-2 rounded-lg text-xs font-semibold border transition-all",
                  tipoAjuste === "agregar"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground"
                )}
              >
                + Entrada (Sumar)
              </button>
              <button
                type="button"
                onClick={() => setTipoAjuste("reducir")}
                className={cn(
                  "py-2 rounded-lg text-xs font-semibold border transition-all",
                  tipoAjuste === "reducir"
                    ? "bg-destructive text-destructive-foreground border-destructive"
                    : "bg-background border-border text-muted-foreground"
                )}
              >
                - Salida (Restar)
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cant-ajuste">Cantidad de unidades</Label>
              <Input
                id="cant-ajuste"
                type="number"
                min="1"
                value={cantidadAjuste}
                onChange={(e) => setCantidadAjuste(e.target.value)}
                required
                disabled={savingAjuste}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAjusteModalOpen(false)}
                disabled={savingAjuste}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingAjuste}>
                {savingAjuste ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Aplicar Ajuste"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Importar Productos desde Excel */}
      <Dialog open={modalImportOpen} onOpenChange={setModalImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Importación Masiva de Productos
            </DialogTitle>
            <DialogDescription>
              Carga tu catálogo completo desde un archivo Excel (.xlsx, .xls) o CSV.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Paso 1: Descargar plantilla */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-dashed border-border bg-muted/20">
              <div className="text-xs space-y-0.5">
                <span className="font-bold text-foreground">¿No tienes el formato?</span>
                <p className="text-muted-foreground">Descarga nuestra plantilla oficial con columnas listas.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={descargarPlantillaProductos}
                className="gap-1.5 text-xs font-semibold"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600" />
                Plantilla Excel
              </Button>
            </div>

            {/* Paso 2: Subir archivo */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Seleccionar archivo Excel o CSV</Label>
              <Input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleArchivoExcelSeleccionado}
                className="cursor-pointer file:cursor-pointer text-xs"
              />
            </div>

            {/* Vista previa de productos detectados */}
            {productosImportados.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ✓ {productosImportados.length} productos detectados listos para importar
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto border rounded-xl divide-y divide-border text-xs">
                  {productosImportados.slice(0, 5).map((p, idx) => (
                    <div key={idx} className="p-2.5 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-foreground">{p.nombre}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {p.categoria || "Sin categoría"} {p.codigo ? `• Cod: ${p.codigo}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-foreground">{formatMoney(p.precio_venta)}</div>
                        <div className="text-[10px] text-muted-foreground">Stock: {p.stock} u.</div>
                      </div>
                    </div>
                  ))}
                  {productosImportados.length > 5 && (
                    <div className="p-2 text-center text-[11px] text-muted-foreground bg-muted/20">
                      y {productosImportados.length - 5} productos más...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalImportOpen(false);
                setProductosImportados([]);
              }}
              disabled={importing}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarImportacion}
              disabled={productosImportados.length === 0 || importing}
              className="gap-2 font-bold"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando a Base de Datos...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importar {productosImportados.length > 0 ? `(${productosImportados.length})` : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Imprimir Etiquetas Código de Barras */}
      <Dialog open={modalEtiquetasOpen} onOpenChange={setModalEtiquetasOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Imprimir Etiquetas
            </DialogTitle>
            <DialogDescription className="text-xs">
              {productoParaEtiqueta?.nombre} • Código: {productoParaEtiqueta?.codigo || productoParaEtiqueta?.codigo_interno}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg border border-border bg-muted/20 text-center space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                Precio a mostrar en etiqueta
              </span>
              <p className="text-xl font-black text-primary">
                {formatMoney(productoParaEtiqueta?.precio_venta)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cant-etiquetas" className="text-xs font-semibold">
                Cantidad de etiquetas a generar
              </Label>
              <Input
                id="cant-etiquetas"
                type="number"
                min={1}
                max={200}
                value={cantidadEtiquetas}
                onChange={(e) => setCantidadEtiquetas(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <div className="flex gap-1.5 pt-1">
                {[6, 12, 24, 48].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCantidadEtiquetas(n)}
                    className="flex-1 py-1 text-xs border rounded-md hover:bg-muted font-medium"
                  >
                    {n} u.
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalEtiquetasOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={ejecutarImpresionEtiquetas} className="gap-1.5 font-bold">
              <Printer className="h-4 w-4" />
              Imprimir {cantidadEtiquetas} Etiquetas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ver Variantes */}
      <Dialog
        open={!!variantesModalProd}
        onOpenChange={(open) => !open && setVariantesModalProd(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <span>Variantes de {variantesModalProd?.nombre}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Variantes registradas en el catálogo con sus respectivos precios y stocks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-80 overflow-y-auto">
            {variantesModalProd &&
              variantsOf(variantesModalProd.id).map((v) => {
                const vStock = Number(v.stock || 0);
                const vPrecio = Number(
                  v.precio_promocional ?? v.precio_venta ?? variantesModalProd.precio_promocional ?? variantesModalProd.precio_venta ?? 0
                );
                const vImg = v.imagen_url || variantesModalProd.imagen_url;

                return (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-card"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center border">
                        {vImg ? (
                          <img
                            src={vImg}
                            alt={v.nombre}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground/40" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-xs text-foreground truncate">
                          {v.nombre}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span>{vStock} u. stock</span>
                          {v.codigo && (
                            <span className="font-mono text-[10px] text-muted-foreground/70">
                              #{v.codigo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-xs text-primary">
                        {formatMoney(vPrecio)}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setVariantesModalProd(null)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Asignación Rápida Individual de Categoría */}
      <Dialog
        open={!!asignarCatProd}
        onOpenChange={(open) => !open && setAsignarCatProd(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderPlus className="h-5 w-5 text-primary" />
              <span>Asignar Categoría</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Asigna o cambia la categoría de{" "}
              <strong className="text-foreground">
                {asignarCatProd?.nombre}
              </strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cat-rapida-input" className="text-xs font-semibold">
                Categoría
              </Label>
              <div className="flex gap-2">
                <Input
                  id="cat-rapida-input"
                  list="datalist-cat-rapida"
                  placeholder="Escribe o selecciona una categoría..."
                  value={catRapida}
                  onChange={(e) => setCatRapida(e.target.value)}
                  disabled={guardandoCatRapida}
                  className="flex-1"
                />
                {categoriasDisponibles.length > 0 && (
                  <select
                    className="h-9 w-32 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring shrink-0 cursor-pointer"
                    value={
                      categoriasDisponibles.includes(catRapida) ? catRapida : ""
                    }
                    onChange={(e) => {
                      if (e.target.value) setCatRapida(e.target.value);
                    }}
                    disabled={guardandoCatRapida}
                  >
                    <option value="">📂 Lista...</option>
                    {categoriasDisponibles.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <datalist id="datalist-cat-rapida">
                {categoriasDisponibles.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {/* Categorías existentes rápidas */}
            {categoriasDisponibles.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground block">
                  Categorías disponibles en tu negocio:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 border rounded-lg bg-muted/20">
                  {categoriasDisponibles.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatRapida(c)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-md border transition-colors cursor-pointer",
                        catRapida === c
                          ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                          : "bg-background hover:bg-muted text-foreground border-border"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {asignarCatProd?.categoria && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() =>
                  asignarCatProd &&
                  aplicarCategoriaAProducto(asignarCatProd.id, null)
                }
                disabled={guardandoCatRapida}
                className="w-full sm:w-auto text-xs"
              >
                Quitar Categoría
              </Button>
            )}
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAsignarCatProd(null)}
                disabled={guardandoCatRapida}
                className="text-xs flex-1 sm:flex-initial"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  asignarCatProd &&
                  aplicarCategoriaAProducto(asignarCatProd.id, catRapida)
                }
                disabled={guardandoCatRapida}
                className="text-xs flex-1 sm:flex-initial bg-primary text-primary-foreground font-semibold"
              >
                {guardandoCatRapida ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Categoría"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Asignación Masiva de Categoría */}
      <Dialog
        open={modalAsignarMasivoOpen}
        onOpenChange={setModalAsignarMasivoOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderPlus className="h-5 w-5 text-primary" />
              <span>Asignar Categoría en Lote</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Se aplicará la categoría a los{" "}
              <strong className="text-foreground">
                {selectedIds.size} productos seleccionados
              </strong>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cat-masiva-input" className="text-xs font-semibold">
                Categoría Destino
              </Label>
              <div className="flex gap-2">
                <Input
                  id="cat-masiva-input"
                  list="datalist-cat-masiva"
                  placeholder="Escribe o selecciona una categoría..."
                  value={catMasiva}
                  onChange={(e) => setCatMasiva(e.target.value)}
                  disabled={guardandoCatMasiva}
                  className="flex-1"
                />
                {categoriasDisponibles.length > 0 && (
                  <select
                    className="h-9 w-32 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring shrink-0 cursor-pointer"
                    value={
                      categoriasDisponibles.includes(catMasiva) ? catMasiva : ""
                    }
                    onChange={(e) => {
                      if (e.target.value) setCatMasiva(e.target.value);
                    }}
                    disabled={guardandoCatMasiva}
                  >
                    <option value="">📂 Lista...</option>
                    {categoriasDisponibles.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <datalist id="datalist-cat-masiva">
                {categoriasDisponibles.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {categoriasDisponibles.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground block">
                  Categorías disponibles:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 border rounded-lg bg-muted/20">
                  {categoriasDisponibles.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatMasiva(c)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-md border transition-colors cursor-pointer",
                        catMasiva === c
                          ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                          : "bg-background hover:bg-muted text-foreground border-border"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => aplicarCategoriaMasiva(null)}
              disabled={guardandoCatMasiva}
              className="w-full sm:w-auto text-xs"
            >
              Quitar Categoría a Seleccionados
            </Button>
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalAsignarMasivoOpen(false)}
                disabled={guardandoCatMasiva}
                className="text-xs flex-1 sm:flex-initial"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => aplicarCategoriaMasiva(catMasiva)}
                disabled={guardandoCatMasiva || !catMasiva.trim()}
                className="text-xs flex-1 sm:flex-initial bg-primary text-primary-foreground font-semibold"
              >
                {guardandoCatMasiva ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    Aplicando...
                  </>
                ) : (
                  `Aplicar a ${selectedIds.size} productos`
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Escáner de Código de Barras con Cámara */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setCodigo(code);
          toast.success(`Código escaneado: ${code}`);
        }}
      />
    </div>
  );
}
