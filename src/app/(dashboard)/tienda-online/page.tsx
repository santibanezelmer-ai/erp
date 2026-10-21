"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { THEMES_LIST, getThemeMetadata } from "@/components/catalog/themes/registry";
import type { ThemeId, ThemeCustomConfig } from "@/types/theme.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Palette,
  Layout,
  Eye,
  Check,
  Save,
  Send,
  RotateCcw,
  ExternalLink,
  Copy,
  Smartphone,
  Monitor,
  Sparkles,
  Wrench,
  Hammer,
  Store,
  Layers,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function TiendaOnlinePage() {
  const { negocio, profile } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Estados de Configuración
  const [activeThemeId, setActiveThemeId] = useState<ThemeId>("beauty");
  const [draftConfig, setDraftConfig] = useState<ThemeCustomConfig>({});
  const [publishedConfig, setPublishedConfig] = useState<ThemeCustomConfig>({});
  const [hasDraft, setHasDraft] = useState(false);

  // Pestaña actual y vista previa
  const [tab, setTab] = useState("galeria");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [filtroRubro, setFiltroRubro] = useState<string>("todos");
  const [copiado, setCopiado] = useState(false);

  // Cargar configuración de la tienda desde Supabase
  useEffect(() => {
    if (!negocio) return;

    const loadConfig = async () => {
      setLoading(true);
      const supabase = createClient();
      try {
        const { data, error } = await supabase
          .from("configuracion")
          .select("plantilla_id, plantilla_config, plantilla_draft")
          .eq("negocio_id", negocio.id)
          .maybeSingle();

        if (data) {
          const tId = (data.plantilla_id as ThemeId) || "beauty";
          const pubCfg = (data.plantilla_config as ThemeCustomConfig) || {};
          const dftCfg = (data.plantilla_draft as ThemeCustomConfig) || null;

          setActiveThemeId(tId);
          setPublishedConfig(pubCfg);

          if (dftCfg) {
            setDraftConfig(dftCfg);
            setHasDraft(true);
          } else {
            const meta = getThemeMetadata(tId);
            setDraftConfig({ ...meta.defaultConfig, ...pubCfg });
            setHasDraft(false);
          }
        } else {
          // Si no existe fila en configuracion, inicializar con defaults
          const meta = getThemeMetadata("beauty");
          setActiveThemeId("beauty");
          setDraftConfig(meta.defaultConfig);
        }
      } catch (err) {
        console.error("Error al cargar configuración de tienda:", err);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [negocio]);

  // Selección de plantilla
  const handleSelectTheme = (themeId: ThemeId) => {
    const meta = getThemeMetadata(themeId);
    setActiveThemeId(themeId);
    setDraftConfig((prev) => ({
      ...meta.defaultConfig,
      ...prev,
      primaryColor: meta.defaultConfig.primaryColor,
      bannerTitle: meta.defaultConfig.bannerTitle,
      bannerSubtitle: meta.defaultConfig.bannerSubtitle,
      bannerBadgeText: meta.defaultConfig.bannerBadgeText,
    }));
    setHasDraft(true);
    toast.info(`Plantilla "${meta.name}" seleccionada como borrador.`);
  };

  // Guardar como Borrador
  const handleSaveDraft = async () => {
    if (!negocio) return;
    setSaving(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.from("configuracion").upsert(
        {
          negocio_id: negocio.id,
          plantilla_id: activeThemeId,
          plantilla_draft: draftConfig as any,
          plantilla_updated_at: new Date().toISOString(),
        },
        { onConflict: "negocio_id" }
      );

      if (error) throw error;
      setHasDraft(true);
      toast.success("Borrador guardado exitosamente. Puedes previsualizarlo antes de publicar.");
    } catch (err: any) {
      toast.error(err.message || "Error al guardar borrador");
    } finally {
      setSaving(false);
    }
  };

  // Publicar Cambios en Vivo
  const handlePublish = async () => {
    if (!negocio) return;
    setPublishing(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.from("configuracion").upsert(
        {
          negocio_id: negocio.id,
          plantilla_id: activeThemeId,
          plantilla_config: draftConfig as any,
          plantilla_draft: null, // Limpiar borrador al publicar
          plantilla_updated_at: new Date().toISOString(),
        },
        { onConflict: "negocio_id" }
      );

      if (error) throw error;
      setPublishedConfig(draftConfig);
      setHasDraft(false);
      toast.success("¡Tu tienda web ha sido actualizada y publicada con éxito!");
    } catch (err: any) {
      toast.error(err.message || "Error al publicar plantilla");
    } finally {
      setPublishing(false);
    }
  };

  // Restaurar a la configuración publicada
  const handleDiscardDraft = () => {
    setDraftConfig(publishedConfig);
    setHasDraft(false);
    toast.info("Borrador descartado. Se restauró la versión actualmente publicada.");
  };

  const storeUrl = negocio ? `https://operixerp.cloud/c/${negocio.slug}` : "";
  const previewUrl = negocio
    ? `/c/${negocio.slug}?preview=true&theme=${activeThemeId}`
    : "";

  const handleCopy = () => {
    if (storeUrl) {
      navigator.clipboard.writeText(storeUrl);
      setCopiado(true);
      toast.success("Enlace copiado al portapapeles");
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  const themesFiltered = THEMES_LIST.filter((t) => {
    if (filtroRubro === "todos") return true;
    return t.category === filtroRubro;
  });

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-semibold text-muted-foreground uppercase">
          Cargando configuración de tienda web...
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-1">
            <Store className="h-4 w-4" />
            <span>Mi Tienda Web • Catálogo Online</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Diseño y Plantillas
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Personaliza la apariencia de tu catálogo público sin tocar código. Tus clientes comprarán directamente por WhatsApp.
          </p>
        </div>

        {/* Acciones de Publicación */}
        <div className="flex flex-wrap items-center gap-2">
          {hasDraft && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscardDraft}
              className="text-xs gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Descartar Borrador
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={saving}
            className="text-xs gap-1.5"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar Borrador
          </Button>

          <Button
            size="sm"
            onClick={handlePublish}
            disabled={publishing}
            className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
          >
            {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Publicar en Mi Tienda
          </Button>
        </div>
      </div>

      {/* Barra de Enlace Público y Estado */}
      <div className="bg-muted/40 border border-border rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-foreground shrink-0">Tu Tienda Web:</span>
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-mono truncate"
          >
            {storeUrl}
          </a>
          <button
            onClick={handleCopy}
            className="p-1 rounded text-muted-foreground hover:text-foreground shrink-0"
            title="Copiar enlace"
          >
            {copiado ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasDraft ? (
            <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10 text-[11px]">
              ● Tienes cambios en borrador sin publicar
            </Badge>
          ) : (
            <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10 text-[11px]">
              ✓ Configuración sincronizada y en vivo
            </Badge>
          )}
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            Abrir Tienda <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Tabs Principales */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-xl">
          <TabsTrigger value="galeria" className="text-xs sm:text-sm font-semibold gap-2">
            <Layout className="h-4 w-4" />
            Galería de Plantillas
          </TabsTrigger>
          <TabsTrigger value="personalizar" className="text-xs sm:text-sm font-semibold gap-2">
            <Palette className="h-4 w-4" />
            Personalizar Tema
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs sm:text-sm font-semibold gap-2">
            <Eye className="h-4 w-4" />
            Vista Previa en Vivo
          </TabsTrigger>
        </TabsList>

        {/* 1. GALERÍA DE PLANTILLAS */}
        <TabsContent value="galeria" className="space-y-6">
          {/* Filtro por Rubro */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Filtrar por rubro:</span>
            {["todos", "belleza", "automotriz", "ferreteria"].map((rubro) => (
              <button
                key={rubro}
                onClick={() => setFiltroRubro(rubro)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  filtroRubro === rubro
                    ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {rubro === "todos"
                  ? "Todas las Plantillas"
                  : rubro === "belleza"
                  ? "🌸 Belleza / Cosmética"
                  : rubro === "automotriz"
                  ? "⚙️ Automotriz / Repuestos"
                  : "🔨 Ferretería / Obras"}
              </button>
            ))}
          </div>

          {/* Cards de Plantillas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {themesFiltered.map((theme) => {
              const isSelected = activeThemeId === theme.id;

              return (
                <Card
                  key={theme.id}
                  className={`flex flex-col justify-between overflow-hidden transition-all duration-200 border-2 ${
                    isSelected
                      ? "border-primary shadow-md ring-2 ring-primary/20"
                      : "border-border hover:border-border/80 shadow-xs"
                  }`}
                >
                  <div>
                    {/* Header Card Visual Mock */}
                    <div
                      className={`h-40 w-full p-4 flex flex-col justify-between border-b border-border ${
                        theme.id === "beauty"
                          ? "bg-gradient-to-br from-rose-100 via-rose-50 to-pink-100 dark:from-rose-950 dark:to-neutral-900"
                          : theme.id === "autoparts"
                          ? "bg-gradient-to-br from-neutral-900 via-neutral-950 to-black text-white"
                          : "bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            theme.id === "beauty"
                              ? "bg-white/80 text-rose-700"
                              : theme.id === "autoparts"
                              ? "bg-amber-500 text-neutral-950 font-black"
                              : "bg-orange-500 text-white font-bold"
                          }`}
                        >
                          {theme.category}
                        </span>

                        {isSelected && (
                          <span className="bg-primary text-primary-foreground text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                            <Check className="h-3 w-3" /> ACTIVA
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="text-xl font-black">{theme.name}</div>
                        <div className="text-xs opacity-80 line-clamp-1">{theme.tagline}</div>
                      </div>
                    </div>

                    <CardHeader className="pb-3 pt-4">
                      <CardTitle className="text-base font-bold">{theme.name}</CardTitle>
                      <CardDescription className="text-xs leading-relaxed">
                        {theme.description}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3 pt-0">
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Ideal para:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {theme.compatibleRubros.map((rubro, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[10px]">
                            {rubro}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </div>

                  <CardFooter className="pt-3 border-t border-border flex items-center gap-2">
                    <Button
                      onClick={() => handleSelectTheme(theme.id)}
                      variant={isSelected ? "secondary" : "default"}
                      className="w-full text-xs font-semibold"
                    >
                      {isSelected ? "Plantilla Seleccionada" : "Usar Esta Plantilla"}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        handleSelectTheme(theme.id);
                        setTab("preview");
                      }}
                      title="Probar en vista previa"
                      className="shrink-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* 2. PERSONALIZAR TEMA */}
        <TabsContent value="personalizar" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna Izquierda: Identidad y Colores */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" />
                    Colores y Estilo Visual
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Define los acentos de color que representarán a tu marca.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Color Primario / Botones</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={draftConfig.primaryColor || "#e11d48"}
                        onChange={(e) => {
                          setDraftConfig((prev) => ({ ...prev, primaryColor: e.target.value }));
                          setHasDraft(true);
                        }}
                        className="h-9 w-12 rounded cursor-pointer border border-border p-1 bg-background"
                      />
                      <Input
                        type="text"
                        value={draftConfig.primaryColor || ""}
                        onChange={(e) => {
                          setDraftConfig((prev) => ({ ...prev, primaryColor: e.target.value }));
                          setHasDraft(true);
                        }}
                        placeholder="#e11d48"
                        className="font-mono text-xs uppercase"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Color de Acento / Badges</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={draftConfig.accentColor || "#f59e0b"}
                        onChange={(e) => {
                          setDraftConfig((prev) => ({ ...prev, accentColor: e.target.value }));
                          setHasDraft(true);
                        }}
                        className="h-9 w-12 rounded cursor-pointer border border-border p-1 bg-background"
                      />
                      <Input
                        type="text"
                        value={draftConfig.accentColor || ""}
                        onChange={(e) => {
                          setDraftConfig((prev) => ({ ...prev, accentColor: e.target.value }));
                          setHasDraft(true);
                        }}
                        placeholder="#f59e0b"
                        className="font-mono text-xs uppercase"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Visibilidad de Secciones */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    Secciones del Catálogo
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Activa o desactiva bloques según las necesidades de tu tienda.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { key: "bannerHero", label: "Banner Principal (Hero)" },
                    { key: "categoriasPills", label: "Barra de Categorías" },
                    { key: "ofertasDestacadas", label: "Filtro de Ofertas Destacadas" },
                    { key: "novedades", label: "Badge de Novedades" },
                    { key: "marcasGrid", label: "Filtro de Fabricantes / Marcas" },
                  ].map(({ key, label }) => {
                    const isChecked =
                      (draftConfig.sectionsVisibility as any)?.[key] !== false;

                    return (
                      <div key={key} className="flex items-center justify-between py-1">
                        <Label htmlFor={`sec-${key}`} className="text-xs font-medium cursor-pointer">
                          {label}
                        </Label>
                        <Switch
                          id={`sec-${key}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            setDraftConfig((prev) => ({
                              ...prev,
                              sectionsVisibility: {
                                ...prev.sectionsVisibility,
                                [key]: checked,
                              },
                            }));
                            setHasDraft(true);
                          }}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Columna Derecha: Banners Promocionales y Textos */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" />
                    Contenido del Banner Promocional
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Configura los mensajes de bienvenida y campañas destacadas de tu tienda.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Distintivo Superior (Badge)</Label>
                    <Input
                      value={draftConfig.bannerBadgeText || ""}
                      onChange={(e) => {
                        setDraftConfig((prev) => ({ ...prev, bannerBadgeText: e.target.value }));
                        setHasDraft(true);
                      }}
                      placeholder="Ej: ✨ Colección Exclusiva o ⚡ Despacho Inmediato"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Título Principal del Banner</Label>
                    <Input
                      value={draftConfig.bannerTitle || ""}
                      onChange={(e) => {
                        setDraftConfig((prev) => ({ ...prev, bannerTitle: e.target.value }));
                        setHasDraft(true);
                      }}
                      placeholder="Ej: Los mejores repuestos para tu vehículo"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Bajada o Subtítulo</Label>
                    <Input
                      value={draftConfig.bannerSubtitle || ""}
                      onChange={(e) => {
                        setDraftConfig((prev) => ({ ...prev, bannerSubtitle: e.target.value }));
                        setHasDraft(true);
                      }}
                      placeholder="Ej: Calidad garantizada, cotiza directo por WhatsApp con entrega en el día."
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Texto del Botón de Acción</Label>
                    <Input
                      value={draftConfig.bannerButtonText || ""}
                      onChange={(e) => {
                        setDraftConfig((prev) => ({ ...prev, bannerButtonText: e.target.value }));
                        setHasDraft(true);
                      }}
                      placeholder="Ej: Ver Ofertas Especiales"
                      className="text-xs"
                    />
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border pt-4 flex justify-end gap-2">
                  <Button
                    onClick={handleSaveDraft}
                    disabled={saving}
                    className="text-xs gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Guardar Cambios en Borrador
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* 3. VISTA PREVIA EN VIVO */}
        <TabsContent value="preview" className="space-y-4">
          <div className="bg-muted/40 border border-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Dispositivo de Vista Previa:</span>
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-background">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    previewDevice === "desktop"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Escritorio (PC)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    previewDevice === "mobile"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  Móvil (Smartphone)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                Plantilla evaluada: <strong className="text-foreground uppercase">{activeThemeId}</strong>
              </span>
              <Button
                size="sm"
                onClick={handlePublish}
                disabled={publishing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 gap-1.5 shadow-xs"
              >
                <Send className="h-3.5 w-3.5" />
                Publicar Ahora
              </Button>
            </div>
          </div>

          {/* Iframe Preview Container */}
          <div className="flex justify-center w-full min-h-[750px] bg-neutral-900/10 rounded-2xl p-4 border border-border">
            <div
              className={`transition-all duration-300 bg-background overflow-hidden border border-border shadow-2xl ${
                previewDevice === "mobile"
                  ? "w-[390px] h-[780px] rounded-[40px] border-4 border-neutral-800 shadow-2xl relative"
                  : "w-full h-[780px] rounded-xl"
              }`}
            >
              {previewDevice === "mobile" && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-4 bg-neutral-800 rounded-full z-20" />
              )}
              <iframe
                src={previewUrl}
                title="Vista previa del catálogo"
                className="w-full h-full border-none pt-1"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
