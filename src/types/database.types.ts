export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ajuste_lineas: {
        Row: {
          ajuste_id: string
          created_at: string
          diferencia: number | null
          id: string
          motivo: string | null
          negocio_id: string
          nombre: string | null
          producto_id: string | null
          stock_actual: number
          stock_contado: number
        }
        Insert: {
          ajuste_id: string
          created_at?: string
          diferencia?: number | null
          id?: string
          motivo?: string | null
          negocio_id: string
          nombre?: string | null
          producto_id?: string | null
          stock_actual?: number
          stock_contado?: number
        }
        Update: {
          ajuste_id?: string
          created_at?: string
          diferencia?: number | null
          id?: string
          motivo?: string | null
          negocio_id?: string
          nombre?: string | null
          producto_id?: string | null
          stock_actual?: number
          stock_contado?: number
        }
        Relationships: [
          {
            foreignKeyName: "ajuste_lineas_ajuste_id_fkey"
            columns: ["ajuste_id"]
            isOneToOne: false
            referencedRelation: "ajustes_inventario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajuste_lineas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajuste_lineas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajuste_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajuste_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ajustes_inventario: {
        Row: {
          created_at: string
          estado: string
          id: string
          negocio_id: string
          nombre: string | null
          notas: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          estado?: string
          id?: string
          negocio_id: string
          nombre?: string | null
          notas?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          estado?: string
          id?: string
          negocio_id?: string
          nombre?: string | null
          notas?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ajustes_inventario_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajustes_inventario_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          activa: boolean
          created_at: string
          id: string
          negocio_id: string
          nombre: string
          tipo_impresion: string | null
        }
        Insert: {
          activa?: boolean
          created_at?: string
          id?: string
          negocio_id: string
          nombre: string
          tipo_impresion?: string | null
        }
        Update: {
          activa?: boolean
          created_at?: string
          id?: string
          negocio_id?: string
          nombre?: string
          tipo_impresion?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          negocio_id: string
          usuario_id: string | null
        }
        Insert: {
          action?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          negocio_id: string
          usuario_id?: string | null
        }
        Update: {
          action?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          negocio_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      caja_sesiones: {
        Row: {
          abierta_at: string
          cerrada_at: string | null
          cerrada_por: string | null
          created_at: string
          diferencia: number | null
          estado: string
          id: string
          monto_contado: number | null
          monto_esperado: number | null
          monto_inicial: number
          negocio_id: string
          notas: string | null
          sucursal_id: string | null
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          abierta_at?: string
          cerrada_at?: string | null
          cerrada_por?: string | null
          created_at?: string
          diferencia?: number | null
          estado?: string
          id?: string
          monto_contado?: number | null
          monto_esperado?: number | null
          monto_inicial?: number
          negocio_id: string
          notas?: string | null
          sucursal_id?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          abierta_at?: string
          cerrada_at?: string | null
          cerrada_por?: string | null
          created_at?: string
          diferencia?: number | null
          estado?: string
          id?: string
          monto_contado?: number | null
          monto_esperado?: number | null
          monto_inicial?: number
          negocio_id?: string
          notas?: string | null
          sucursal_id?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caja_sesiones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          activa: boolean
          color: string | null
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          negocio_id: string
          nombre: string
          orden: number
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          activa?: boolean
          color?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          negocio_id: string
          nombre: string
          orden?: number
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          activa?: boolean
          color?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          negocio_id?: string
          nombre?: string
          orden?: number
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias_public"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          created_at: string
          deuda_total: number
          direccion: string | null
          email: string | null
          id: string
          negocio_id: string
          nombre: string
          notas: string | null
          telefono: string | null
        }
        Insert: {
          created_at?: string
          deuda_total?: number
          direccion?: string | null
          email?: string | null
          id?: string
          negocio_id: string
          nombre: string
          notas?: string | null
          telefono?: string | null
        }
        Update: {
          created_at?: string
          deuda_total?: number
          direccion?: string | null
          email?: string | null
          id?: string
          negocio_id?: string
          nombre?: string
          notas?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      comanda_items: {
        Row: {
          area_id: string | null
          comanda_id: string
          created_at: string
          estado: string
          id: string
          modificadores: Json | null
          negocio_id: string
          nombre: string
          notas: string | null
          precio: number
          producto_id: string | null
          qty: number
          requiere_preparacion: boolean
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          comanda_id: string
          created_at?: string
          estado?: string
          id?: string
          modificadores?: Json | null
          negocio_id: string
          nombre: string
          notas?: string | null
          precio?: number
          producto_id?: string | null
          qty?: number
          requiere_preparacion?: boolean
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          comanda_id?: string
          created_at?: string
          estado?: string
          id?: string
          modificadores?: Json | null
          negocio_id?: string
          nombre?: string
          notas?: string | null
          precio?: number
          producto_id?: string | null
          qty?: number
          requiere_preparacion?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      comandas: {
        Row: {
          cliente_nombre: string | null
          cliente_telefono: string | null
          closed_at: string | null
          created_at: string
          direccion: string | null
          estado: string
          id: string
          mesa_id: string | null
          mesero_id: string | null
          negocio_id: string
          notas: string | null
          tipo: string
          total: number
          venta_id: string | null
        }
        Insert: {
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          closed_at?: string | null
          created_at?: string
          direccion?: string | null
          estado?: string
          id?: string
          mesa_id?: string | null
          mesero_id?: string | null
          negocio_id: string
          notas?: string | null
          tipo?: string
          total?: number
          venta_id?: string | null
        }
        Update: {
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          closed_at?: string | null
          created_at?: string
          direccion?: string | null
          estado?: string
          id?: string
          mesa_id?: string | null
          mesero_id?: string | null
          negocio_id?: string
          notas?: string | null
          tipo?: string
          total?: number
          venta_id?: string | null
        }
        Relationships: []
      }
      combos: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: string
          items: Json
          negocio_id: string
          nombre: string
          precio: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          items?: Json
          negocio_id: string
          nombre: string
          precio?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          items?: Json
          negocio_id?: string
          nombre?: string
          precio?: number
          updated_at?: string
        }
        Relationships: []
      }
      compra_detalle: {
        Row: {
          cantidad: number | null
          cantidad_recibida: number | null
          compra_id: string
          created_at: string
          id: string
          negocio_id: string
          nombre_producto: string | null
          precio_unitario: number | null
          producto_id: string | null
          total_linea: number | null
        }
        Insert: {
          cantidad?: number | null
          cantidad_recibida?: number | null
          compra_id: string
          created_at?: string
          id?: string
          negocio_id: string
          nombre_producto?: string | null
          precio_unitario?: number | null
          producto_id?: string | null
          total_linea?: number | null
        }
        Update: {
          cantidad?: number | null
          cantidad_recibida?: number | null
          compra_id?: string
          created_at?: string
          id?: string
          negocio_id?: string
          nombre_producto?: string | null
          precio_unitario?: number | null
          producto_id?: string | null
          total_linea?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compra_detalle_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_detalle_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_detalle_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_public"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          created_at: string
          descuento: number | null
          estado: string
          fecha: string
          id: string
          negocio_id: string
          numero_doc: string | null
          observaciones: string | null
          proveedor_id: string | null
          proveedor_nombre: string | null
          recibida_at: string | null
          recibida_por: string | null
          subtotal: number | null
          tipo_doc: string | null
          total: number | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          descuento?: number | null
          estado?: string
          fecha?: string
          id?: string
          negocio_id: string
          numero_doc?: string | null
          observaciones?: string | null
          proveedor_id?: string | null
          proveedor_nombre?: string | null
          recibida_at?: string | null
          recibida_por?: string | null
          subtotal?: number | null
          tipo_doc?: string | null
          total?: number | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          descuento?: number | null
          estado?: string
          fecha?: string
          id?: string
          negocio_id?: string
          numero_doc?: string | null
          observaciones?: string | null
          proveedor_id?: string | null
          proveedor_nombre?: string | null
          recibida_at?: string | null
          recibida_por?: string | null
          subtotal?: number | null
          tipo_doc?: string | null
          total?: number | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compras_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion: {
        Row: {
          business_name: string | null
          color_primary: string | null
          created_at: string
          direccion: string | null
          id: string
          logo_url: string | null
          modulos_override: Json
          moneda: string | null
          negocio_id: string
          rut: string | null
          telefono: string | null
        }
        Insert: {
          business_name?: string | null
          color_primary?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          logo_url?: string | null
          modulos_override?: Json
          moneda?: string | null
          negocio_id: string
          rut?: string | null
          telefono?: string | null
        }
        Update: {
          business_name?: string | null
          color_primary?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          logo_url?: string | null
          modulos_override?: Json
          moneda?: string | null
          negocio_id?: string
          rut?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracion_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      contabilidad: {
        Row: {
          categoria: string | null
          created_at: string
          descripcion: string | null
          fecha: string
          id: string
          monto: number | null
          negocio_id: string
          tipo: string | null
          usuario_id: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          monto?: number | null
          negocio_id: string
          tipo?: string | null
          usuario_id?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          monto?: number | null
          negocio_id?: string
          tipo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contabilidad_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contabilidad_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cuentas_pagar: {
        Row: {
          created_at: string
          descripcion: string | null
          estado: string
          id: string
          monto: number | null
          negocio_id: string
          proveedor: string | null
          usuario_id: string | null
          vencimiento: string | null
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          estado?: string
          id?: string
          monto?: number | null
          negocio_id: string
          proveedor?: string | null
          usuario_id?: string | null
          vencimiento?: string | null
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          estado?: string
          id?: string
          monto?: number | null
          negocio_id?: string
          proveedor?: string | null
          usuario_id?: string | null
          vencimiento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cuentas_pagar_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuentas_pagar_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cupon_canjes: {
        Row: {
          created_at: string
          cupon_id: string
          dias_aplicados: number
          id: string
          negocio_id: string
          plan_aplicado: string
          user_id: string
          vence_at_nuevo: string
        }
        Insert: {
          created_at?: string
          cupon_id: string
          dias_aplicados: number
          id?: string
          negocio_id: string
          plan_aplicado: string
          user_id: string
          vence_at_nuevo: string
        }
        Update: {
          created_at?: string
          cupon_id?: string
          dias_aplicados?: number
          id?: string
          negocio_id?: string
          plan_aplicado?: string
          user_id?: string
          vence_at_nuevo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cupon_canjes_cupon_id_fkey"
            columns: ["cupon_id"]
            isOneToOne: false
            referencedRelation: "cupones_internos"
            referencedColumns: ["id"]
          },
        ]
      }
      cupones_internos: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          dias_otorgados: number
          id: string
          max_usos: number | null
          notas: string | null
          plan: string
          updated_at: string
          usos: number
          vence_at: string | null
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          dias_otorgados?: number
          id?: string
          max_usos?: number | null
          notas?: string | null
          plan?: string
          updated_at?: string
          usos?: number
          vence_at?: string | null
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          dias_otorgados?: number
          id?: string
          max_usos?: number | null
          notas?: string | null
          plan?: string
          updated_at?: string
          usos?: number
          vence_at?: string | null
        }
        Relationships: []
      }
      detalle_ventas: {
        Row: {
          created_at: string
          descuento: number | null
          id: string
          negocio_id: string
          nombre: string | null
          precio: number | null
          producto_id: string | null
          qty: number | null
          subtotal: number | null
          venta_id: string
        }
        Insert: {
          created_at?: string
          descuento?: number | null
          id?: string
          negocio_id: string
          nombre?: string | null
          precio?: number | null
          producto_id?: string | null
          qty?: number | null
          subtotal?: number | null
          venta_id: string
        }
        Update: {
          created_at?: string
          descuento?: number | null
          id?: string
          negocio_id?: string
          nombre?: string | null
          precio?: number | null
          producto_id?: string | null
          qty?: number | null
          subtotal?: number | null
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "detalle_ventas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_ventas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_ventas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_ventas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_ventas_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      deudas: {
        Row: {
          cliente_id: string | null
          created_at: string
          id: string
          monto: number | null
          negocio_id: string
          notas: string | null
          tipo: string | null
          venta_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          id?: string
          monto?: number | null
          negocio_id: string
          notas?: string | null
          tipo?: string | null
          venta_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          id?: string
          monto?: number | null
          negocio_id?: string
          notas?: string | null
          tipo?: string | null
          venta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deudas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deudas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deudas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deudas_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      devoluciones: {
        Row: {
          created_at: string
          id: string
          monto: number | null
          motivo: string | null
          negocio_id: string
          nombre: string | null
          producto_id: string | null
          qty: number | null
          restituir_stock: boolean
          usuario_id: string | null
          venta_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          monto?: number | null
          motivo?: string | null
          negocio_id: string
          nombre?: string | null
          producto_id?: string | null
          qty?: number | null
          restituir_stock?: boolean
          usuario_id?: string | null
          venta_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          monto?: number | null
          motivo?: string | null
          negocio_id?: string
          nombre?: string | null
          producto_id?: string | null
          qty?: number | null
          restituir_stock?: boolean
          usuario_id?: string | null
          venta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devoluciones_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      flujo_caja: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          monto: number | null
          negocio_id: string
          tipo: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          monto?: number | null
          negocio_id: string
          tipo?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          monto?: number | null
          negocio_id?: string
          tipo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flujo_caja_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flujo_caja_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_precios: {
        Row: {
          costo_nuevo: number | null
          created_at: string
          id: string
          negocio_id: string
          precio_ant: number | null
          precio_nuevo: number | null
          producto_id: string | null
          usuario_id: string | null
        }
        Insert: {
          costo_nuevo?: number | null
          created_at?: string
          id?: string
          negocio_id: string
          precio_ant?: number | null
          precio_nuevo?: number | null
          producto_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          costo_nuevo?: number | null
          created_at?: string
          id?: string
          negocio_id?: string
          precio_ant?: number | null
          precio_nuevo?: number | null
          producto_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historial_precios_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_precios_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_precios_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_precios_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_public"
            referencedColumns: ["id"]
          },
        ]
      }
      invitaciones: {
        Row: {
          codigo: string
          creada_por: string | null
          created_at: string
          email: string | null
          estado: string
          expira_at: string
          id: string
          negocio_id: string
          role: Database["public"]["Enums"]["app_role"]
          sucursal_id: string | null
          updated_at: string
          usada_at: string | null
          usada_por: string | null
        }
        Insert: {
          codigo: string
          creada_por?: string | null
          created_at?: string
          email?: string | null
          estado?: string
          expira_at?: string
          id?: string
          negocio_id: string
          role?: Database["public"]["Enums"]["app_role"]
          sucursal_id?: string | null
          updated_at?: string
          usada_at?: string | null
          usada_por?: string | null
        }
        Update: {
          codigo?: string
          creada_por?: string | null
          created_at?: string
          email?: string | null
          estado?: string
          expira_at?: string
          id?: string
          negocio_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          sucursal_id?: string | null
          updated_at?: string
          usada_at?: string | null
          usada_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitaciones_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      marcas: {
        Row: {
          activa: boolean
          created_at: string
          descripcion: string | null
          id: string
          logo_url: string | null
          negocio_id: string
          nombre: string
          orden: number
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          logo_url?: string | null
          negocio_id: string
          nombre: string
          orden?: number
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          logo_url?: string | null
          negocio_id?: string
          nombre?: string
          orden?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marcas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marcas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      mesas: {
        Row: {
          area_id: string | null
          capacidad: number
          created_at: string
          estado: string
          id: string
          negocio_id: string
          notas: string | null
          numero: string
        }
        Insert: {
          area_id?: string | null
          capacidad?: number
          created_at?: string
          estado?: string
          id?: string
          negocio_id: string
          notas?: string | null
          numero: string
        }
        Update: {
          area_id?: string | null
          capacidad?: number
          created_at?: string
          estado?: string
          id?: string
          negocio_id?: string
          notas?: string | null
          numero?: string
        }
        Relationships: []
      }
      modificador_grupos: {
        Row: {
          created_at: string
          id: string
          max_select: number
          min_select: number
          negocio_id: string
          nombre: string
          obligatorio: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          max_select?: number
          min_select?: number
          negocio_id: string
          nombre: string
          obligatorio?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          max_select?: number
          min_select?: number
          negocio_id?: string
          nombre?: string
          obligatorio?: boolean
        }
        Relationships: []
      }
      modificadores: {
        Row: {
          activo: boolean
          created_at: string
          grupo_id: string
          id: string
          negocio_id: string
          nombre: string
          precio_extra: number
        }
        Insert: {
          activo?: boolean
          created_at?: string
          grupo_id: string
          id?: string
          negocio_id: string
          nombre: string
          precio_extra?: number
        }
        Update: {
          activo?: boolean
          created_at?: string
          grupo_id?: string
          id?: string
          negocio_id?: string
          nombre?: string
          precio_extra?: number
        }
        Relationships: []
      }
      mp_pagos: {
        Row: {
          ciclo: string | null
          created_at: string
          detalle: string | null
          estado: string
          id: string
          moneda: string | null
          monto: number | null
          negocio_id: string | null
          payment_id: string | null
          plan: string | null
          preapproval_id: string | null
          raw: Json | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ciclo?: string | null
          created_at?: string
          detalle?: string | null
          estado?: string
          id?: string
          moneda?: string | null
          monto?: number | null
          negocio_id?: string | null
          payment_id?: string | null
          plan?: string | null
          preapproval_id?: string | null
          raw?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ciclo?: string | null
          created_at?: string
          detalle?: string | null
          estado?: string
          id?: string
          moneda?: string | null
          monto?: number | null
          negocio_id?: string | null
          payment_id?: string | null
          plan?: string | null
          preapproval_id?: string | null
          raw?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mp_pagos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mp_pagos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      negocio_kds_tokens: {
        Row: {
          created_at: string
          kds_token: string
          negocio_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          kds_token?: string
          negocio_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          kds_token?: string
          negocio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "negocio_kds_tokens_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocio_kds_tokens_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      negocios: {
        Row: {
          created_at: string
          direccion: string | null
          id: string
          nombre: string
          perfil: string | null
          plan: string | null
          rut: string | null
          slug: string
          tipo_negocio: string
        }
        Insert: {
          created_at?: string
          direccion?: string | null
          id?: string
          nombre: string
          perfil?: string | null
          plan?: string | null
          rut?: string | null
          slug: string
          tipo_negocio?: string
        }
        Update: {
          created_at?: string
          direccion?: string | null
          id?: string
          nombre?: string
          perfil?: string | null
          plan?: string | null
          rut?: string | null
          slug?: string
          tipo_negocio?: string
        }
        Relationships: []
      }
      pedidos_whatsapp: {
        Row: {
          cliente_id: string | null
          cliente_nombre: string | null
          cliente_telefono: string | null
          created_at: string
          estado: string
          fiado: boolean
          id: string
          items: Json | null
          motivo_devolucion: string | null
          negocio_id: string
          notas: string | null
          saved_at: string | null
          stock_reservado: boolean
          total: number | null
        }
        Insert: {
          cliente_id?: string | null
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          created_at?: string
          estado?: string
          fiado?: boolean
          id?: string
          items?: Json | null
          motivo_devolucion?: string | null
          negocio_id: string
          notas?: string | null
          saved_at?: string | null
          stock_reservado?: boolean
          total?: number | null
        }
        Update: {
          cliente_id?: string | null
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          created_at?: string
          estado?: string
          fiado?: boolean
          id?: string
          items?: Json | null
          motivo_devolucion?: string | null
          negocio_id?: string
          notas?: string | null
          saved_at?: string | null
          stock_reservado?: boolean
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_whatsapp_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_whatsapp_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_imagenes: {
        Row: {
          created_at: string
          es_principal: boolean
          id: string
          negocio_id: string
          orden: number
          producto_id: string
          url: string
        }
        Insert: {
          created_at?: string
          es_principal?: boolean
          id?: string
          negocio_id: string
          orden?: number
          producto_id: string
          url: string
        }
        Update: {
          created_at?: string
          es_principal?: boolean
          id?: string
          negocio_id?: string
          orden?: number
          producto_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_imagenes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_imagenes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_imagenes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_imagenes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_public"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_modificador_grupos: {
        Row: {
          grupo_id: string
          id: string
          negocio_id: string
          producto_id: string
        }
        Insert: {
          grupo_id: string
          id?: string
          negocio_id: string
          producto_id: string
        }
        Update: {
          grupo_id?: string
          id?: string
          negocio_id?: string
          producto_id?: string
        }
        Relationships: []
      }
      producto_variantes: {
        Row: {
          activo: boolean
          codigo: string | null
          created_at: string
          id: string
          imagen_url: string | null
          negocio_id: string
          nombre: string
          precio_costo: number | null
          precio_promocional: number | null
          precio_venta: number | null
          producto_id: string
          promo_vence_at: string | null
          stock: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo?: string | null
          created_at?: string
          id?: string
          imagen_url?: string | null
          negocio_id: string
          nombre: string
          precio_costo?: number | null
          precio_promocional?: number | null
          precio_venta?: number | null
          producto_id: string
          promo_vence_at?: string | null
          stock?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string | null
          created_at?: string
          id?: string
          imagen_url?: string | null
          negocio_id?: string
          nombre?: string
          precio_costo?: number | null
          precio_promocional?: number | null
          precio_venta?: number | null
          producto_id?: string
          promo_vence_at?: string | null
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      productos: {
        Row: {
          activo: boolean
          cantidad_minima: number | null
          categoria: string | null
          categorias: string[]
          codigo: string | null
          codigo_interno: string | null
          created_at: string
          descripcion: string | null
          galeria: Json | null
          id: string
          imagen_url: string | null
          is_new_arrival: boolean
          marca_id: string | null
          negocio_id: string
          nombre: string
          notas: string | null
          precio_costo: number | null
          precio_promocional: number | null
          precio_venta: number | null
          promo_vence_at: string | null
          proveedor: string | null
          requiere_preparacion: boolean
          sin_control_stock: boolean
          stock: number | null
          stock_min: number | null
          sucursal_id: string | null
          unidad: string | null
          updated_at: string
          variantes: Json | null
        }
        Insert: {
          activo?: boolean
          cantidad_minima?: number | null
          categoria?: string | null
          categorias?: string[]
          codigo?: string | null
          codigo_interno?: string | null
          created_at?: string
          descripcion?: string | null
          galeria?: Json | null
          id?: string
          imagen_url?: string | null
          is_new_arrival?: boolean
          marca_id?: string | null
          negocio_id: string
          nombre: string
          notas?: string | null
          precio_costo?: number | null
          precio_promocional?: number | null
          precio_venta?: number | null
          promo_vence_at?: string | null
          proveedor?: string | null
          requiere_preparacion?: boolean
          sin_control_stock?: boolean
          stock?: number | null
          stock_min?: number | null
          sucursal_id?: string | null
          unidad?: string | null
          updated_at?: string
          variantes?: Json | null
        }
        Update: {
          activo?: boolean
          cantidad_minima?: number | null
          categoria?: string | null
          categorias?: string[]
          codigo?: string | null
          codigo_interno?: string | null
          created_at?: string
          descripcion?: string | null
          galeria?: Json | null
          id?: string
          imagen_url?: string | null
          is_new_arrival?: boolean
          marca_id?: string | null
          negocio_id?: string
          nombre?: string
          notas?: string | null
          precio_costo?: number | null
          precio_promocional?: number | null
          precio_venta?: number | null
          promo_vence_at?: string | null
          proveedor?: string | null
          requiere_preparacion?: boolean
          sin_control_stock?: boolean
          stock?: number | null
          stock_min?: number | null
          sucursal_id?: string | null
          unidad?: string | null
          updated_at?: string
          variantes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activo: boolean
          created_at: string
          email: string | null
          id: string
          negocio_id: string | null
          nombre: string
          sucursal_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id: string
          negocio_id?: string | null
          nombre: string
          sucursal_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          negocio_id?: string | null
          nombre?: string
          sucursal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedor_productos: {
        Row: {
          activo: boolean
          costo_promedio: number | null
          id: string
          negocio_id: string
          notas: string | null
          producto_id: string | null
          proveedor_id: string | null
          total_cantidad: number
          total_compras: number
          ultima_fecha: string | null
          ultimo_precio: number | null
        }
        Insert: {
          activo?: boolean
          costo_promedio?: number | null
          id?: string
          negocio_id: string
          notas?: string | null
          producto_id?: string | null
          proveedor_id?: string | null
          total_cantidad?: number
          total_compras?: number
          ultima_fecha?: string | null
          ultimo_precio?: number | null
        }
        Update: {
          activo?: boolean
          costo_promedio?: number | null
          id?: string
          negocio_id?: string
          notas?: string | null
          producto_id?: string | null
          proveedor_id?: string | null
          total_cantidad?: number
          total_compras?: number
          ultima_fecha?: string | null
          ultimo_precio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proveedor_productos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_productos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_productos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_productos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_productos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedores: {
        Row: {
          activo: boolean
          created_at: string
          email: string | null
          id: string
          negocio_id: string
          nombre: string
          rut: string | null
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          negocio_id: string
          nombre: string
          rut?: string | null
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          negocio_id?: string
          nombre?: string
          rut?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proveedores_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedores_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      reorder_rules: {
        Row: {
          activa: boolean
          created_at: string
          id: string
          min_stock: number
          negocio_id: string
          producto_id: string | null
          reorder_qty: number
        }
        Insert: {
          activa?: boolean
          created_at?: string
          id?: string
          min_stock?: number
          negocio_id: string
          producto_id?: string | null
          reorder_qty?: number
        }
        Update: {
          activa?: boolean
          created_at?: string
          id?: string
          min_stock?: number
          negocio_id?: string
          producto_id?: string | null
          reorder_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "reorder_rules_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_rules_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_rules_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_rules_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_public"
            referencedColumns: ["id"]
          },
        ]
      }
      reservas: {
        Row: {
          cliente_nombre: string
          cliente_telefono: string | null
          created_at: string
          estado: string
          fecha: string
          hora: string
          id: string
          mesa_id: string | null
          negocio_id: string
          notas: string | null
          personas: number
        }
        Insert: {
          cliente_nombre: string
          cliente_telefono?: string | null
          created_at?: string
          estado?: string
          fecha: string
          hora: string
          id?: string
          mesa_id?: string | null
          negocio_id: string
          notas?: string | null
          personas?: number
        }
        Update: {
          cliente_nombre?: string
          cliente_telefono?: string | null
          created_at?: string
          estado?: string
          fecha?: string
          hora?: string
          id?: string
          mesa_id?: string | null
          negocio_id?: string
          notas?: string | null
          personas?: number
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          cantidad: number | null
          created_at: string
          id: string
          negocio_id: string
          notas: string | null
          producto_id: string | null
          ref_id: string | null
          ref_tipo: string | null
          stock_antes: number | null
          tipo: string | null
          usuario_id: string | null
        }
        Insert: {
          cantidad?: number | null
          created_at?: string
          id?: string
          negocio_id: string
          notas?: string | null
          producto_id?: string | null
          ref_id?: string | null
          ref_tipo?: string | null
          stock_antes?: number | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Update: {
          cantidad?: number | null
          created_at?: string
          id?: string
          negocio_id?: string
          notas?: string | null
          producto_id?: string | null
          ref_id?: string | null
          ref_tipo?: string | null
          stock_antes?: number | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_public"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sucursales: {
        Row: {
          activa: boolean
          created_at: string
          direccion: string | null
          id: string
          negocio_id: string
          nombre: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          direccion?: string | null
          id?: string
          negocio_id: string
          nombre: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          direccion?: string | null
          id?: string
          negocio_id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "sucursales_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sucursales_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      suscripciones: {
        Row: {
          ciclo: string | null
          created_at: string
          estado: string
          id: string
          inicio_at: string
          mp_payer_email: string | null
          mp_preapproval_id: string | null
          negocio_id: string
          notas: string | null
          plan: string
          proveedor: string
          proximo_cobro_at: string | null
          ultimo_pago_at: string | null
          updated_at: string
          vence_at: string | null
        }
        Insert: {
          ciclo?: string | null
          created_at?: string
          estado?: string
          id?: string
          inicio_at?: string
          mp_payer_email?: string | null
          mp_preapproval_id?: string | null
          negocio_id: string
          notas?: string | null
          plan?: string
          proveedor?: string
          proximo_cobro_at?: string | null
          ultimo_pago_at?: string | null
          updated_at?: string
          vence_at?: string | null
        }
        Update: {
          ciclo?: string | null
          created_at?: string
          estado?: string
          id?: string
          inicio_at?: string
          mp_payer_email?: string | null
          mp_preapproval_id?: string | null
          negocio_id?: string
          notas?: string | null
          plan?: string
          proveedor?: string
          proximo_cobro_at?: string | null
          ultimo_pago_at?: string | null
          updated_at?: string
          vence_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          negocio_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          negocio_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          negocio_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas: {
        Row: {
          cliente_id: string | null
          created_at: string
          descuento: number | null
          efectivo_rec: number | null
          estado: string
          id: string
          negocio_id: string
          pago: string | null
          subtotal: number | null
          sucursal_id: string | null
          total: number | null
          usuario_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          descuento?: number | null
          efectivo_rec?: number | null
          estado?: string
          id?: string
          negocio_id: string
          pago?: string | null
          subtotal?: number | null
          sucursal_id?: string | null
          total?: number | null
          usuario_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          descuento?: number | null
          efectivo_rec?: number | null
          estado?: string
          id?: string
          negocio_id?: string
          pago?: string | null
          subtotal?: number | null
          sucursal_id?: string | null
          total?: number | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      categorias_public: {
        Row: {
          color: string | null
          id: string | null
          negocio_id: string | null
          nombre: string | null
          orden: number | null
          parent_id: string | null
        }
        Insert: {
          color?: string | null
          id?: string | null
          negocio_id?: string | null
          nombre?: string | null
          orden?: number | null
          parent_id?: string | null
        }
        Update: {
          color?: string | null
          id?: string | null
          negocio_id?: string | null
          nombre?: string | null
          orden?: number | null
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias_public"
            referencedColumns: ["id"]
          },
        ]
      }
      marcas_public: {
        Row: {
          descripcion: string | null
          id: string | null
          logo_url: string | null
          negocio_id: string | null
          nombre: string | null
          orden: number | null
        }
        Insert: {
          descripcion?: string | null
          id?: string | null
          logo_url?: string | null
          negocio_id?: string | null
          nombre?: string | null
          orden?: number | null
        }
        Update: {
          descripcion?: string | null
          id?: string | null
          logo_url?: string | null
          negocio_id?: string | null
          nombre?: string | null
          orden?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marcas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marcas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      negocios_public: {
        Row: {
          id: string | null
          nombre: string | null
          slug: string | null
          tipo_negocio: string | null
        }
        Insert: {
          id?: string | null
          nombre?: string | null
          slug?: string | null
          tipo_negocio?: string | null
        }
        Update: {
          id?: string | null
          nombre?: string | null
          slug?: string | null
          tipo_negocio?: string | null
        }
        Relationships: []
      }
      producto_imagenes_public: {
        Row: {
          es_principal: boolean | null
          id: string | null
          orden: number | null
          producto_id: string | null
          url: string | null
        }
        Insert: {
          es_principal?: boolean | null
          id?: string | null
          orden?: number | null
          producto_id?: string | null
          url?: string | null
        }
        Update: {
          es_principal?: boolean | null
          id?: string | null
          orden?: number | null
          producto_id?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producto_imagenes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_imagenes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_public"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_variantes_public: {
        Row: {
          id: string | null
          imagen_url: string | null
          negocio_id: string | null
          nombre: string | null
          precio_promocional: number | null
          precio_venta: number | null
          producto_id: string | null
          promo_vence_at: string | null
          stock: number | null
        }
        Insert: {
          id?: string | null
          imagen_url?: string | null
          negocio_id?: string | null
          nombre?: string | null
          precio_promocional?: number | null
          precio_venta?: number | null
          producto_id?: string | null
          promo_vence_at?: string | null
          stock?: number | null
        }
        Update: {
          id?: string | null
          imagen_url?: string | null
          negocio_id?: string | null
          nombre?: string | null
          precio_promocional?: number | null
          precio_venta?: number | null
          producto_id?: string | null
          promo_vence_at?: string | null
          stock?: number | null
        }
        Relationships: []
      }
      productos_public: {
        Row: {
          cantidad_minima: number | null
          categoria: string | null
          categorias: string[] | null
          codigo: string | null
          descripcion: string | null
          galeria: Json | null
          id: string | null
          imagen_url: string | null
          is_new_arrival: boolean | null
          marca_id: string | null
          negocio_id: string | null
          nombre: string | null
          precio_promocional: number | null
          precio_venta: number | null
          promo_vence_at: string | null
          sin_control_stock: boolean | null
          stock: number | null
          unidad: string | null
        }
        Insert: {
          cantidad_minima?: number | null
          categoria?: string | null
          categorias?: string[] | null
          codigo?: string | null
          descripcion?: string | null
          galeria?: Json | null
          id?: string | null
          imagen_url?: string | null
          is_new_arrival?: boolean | null
          marca_id?: string | null
          negocio_id?: string | null
          nombre?: string | null
          precio_promocional?: number | null
          precio_venta?: number | null
          promo_vence_at?: string | null
          sin_control_stock?: boolean | null
          stock?: number | null
          unidad?: string | null
        }
        Update: {
          cantidad_minima?: number | null
          categoria?: string | null
          categorias?: string[] | null
          codigo?: string | null
          descripcion?: string | null
          galeria?: Json | null
          id?: string | null
          imagen_url?: string | null
          is_new_arrival?: boolean | null
          marca_id?: string | null
          negocio_id?: string | null
          nombre?: string | null
          precio_promocional?: number | null
          precio_venta?: number | null
          promo_vence_at?: string | null
          sin_control_stock?: boolean | null
          stock?: number | null
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aceptar_invitacion: { Args: { _codigo: string }; Returns: Json }
      agregar_producto_a_proveedor: {
        Args: {
          _notas?: string
          _precio: number
          _producto_id: string
          _proveedor_id: string
        }
        Returns: string
      }
      cambiar_estado_pedido: {
        Args: { _motivo?: string; _nuevo_estado: string; _pedido_id: string }
        Returns: undefined
      }
      cancelar_compra: { Args: { _compra_id: string }; Returns: undefined }
      canjear_cupon_interno: { Args: { _codigo: string }; Returns: Json }
      compra_recibida_por_email: {
        Args: { _compra_id: string }
        Returns: string
      }
      crear_pedido_catalogo: {
        Args: {
          _cliente_nombre: string
          _cliente_telefono: string
          _items: Json
          _negocio_id: string
          _notas: string
          _total: number
        }
        Returns: string
      }
      crear_venta_pos: {
        Args: {
          _cliente_id?: string
          _descuento: number
          _efectivo_rec?: number
          _lineas: Json
          _pago: string
          _subtotal: number
          _sucursal_id?: string
          _total: number
        }
        Returns: Json
      }
      create_negocio_for_user: {
        Args: { _nombre: string; _slug: string; _tipo?: string }
        Returns: string
      }
      current_negocio_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      descontar_stock_producto: {
        Args: {
          _producto_id: string
          _qty: number
          _variante_id: string
          _venta_id: string
        }
        Returns: undefined
      }
      devolver_venta: {
        Args: { _items: Json; _motivo?: string; _venta_id: string }
        Returns: Json
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_kds_token: {
        Args: never
        Returns: {
          kds_token: string
          slug: string
        }[]
      }
      get_or_create_marca: { Args: { _nombre: string }; Returns: string }
      get_user_plan: {
        Args: { check_env?: string; user_uuid: string }
        Returns: string
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_negocio: {
        Args: {
          _negocio_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _uid: string }; Returns: boolean }
      kds_set_estado: {
        Args: {
          _estado: string
          _item_id: string
          _slug: string
          _token: string
        }
        Returns: undefined
      }
      kds_snapshot: { Args: { _slug: string; _token: string }; Returns: Json }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      negocio_has_pro: { Args: { _negocio_id: string }; Returns: boolean }
      next_codigo_interno: { Args: { _negocio_id: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recibir_compra: {
        Args: { _compra_id: string; _recepciones: Json }
        Returns: undefined
      }
      sa_cupon_eliminar: { Args: { _id: string }; Returns: undefined }
      sa_cupon_upsert: {
        Args: {
          _activo: boolean
          _codigo: string
          _dias_otorgados: number
          _id: string
          _max_usos: number
          _notas: string
          _plan: string
          _vence_at: string
        }
        Returns: string
      }
      sa_eliminar_negocio: { Args: { _negocio_id: string }; Returns: undefined }
      sa_kpis_globales: { Args: never; Returns: Json }
      sa_negocio_detalle: { Args: { _negocio_id: string }; Returns: Json }
      sa_set_suscripcion: {
        Args: {
          _estado: string
          _negocio_id: string
          _notas?: string
          _plan: string
          _vence_at: string
        }
        Returns: string
      }
      set_modulos_override: { Args: { _overrides: Json }; Returns: undefined }
      set_perfil_negocio: { Args: { _perfil: string }; Returns: undefined }
      set_tipo_negocio: { Args: { _tipo: string }; Returns: undefined }
      suspender_suscripciones_vencidas: { Args: never; Returns: number }
      vincular_pedido_a_fiado: {
        Args: { _cliente_id: string; _pedido_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "cajero" | "vendedor" | "bodeguero" | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "cajero", "vendedor", "bodeguero", "super_admin"],
    },
  },
} as const
