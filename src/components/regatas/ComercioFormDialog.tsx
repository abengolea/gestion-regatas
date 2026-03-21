"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useFirebase } from "@/firebase";
import { getAuth } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import type { Comercio } from "@/lib/types/comercio";

const comercioSchema = z.object({
  razonSocial: z.string().min(2, "Razón social requerida"),
  cuit: z.string().min(10, "CUIT requerido"),
  rubro: z.string().min(2, "Rubro requerido"),
  domicilio: z.string(),
  localidad: z.string(),
  telefono: z.string(),
  email: z.string().email("Email inválido").or(z.literal("")),
  responsable: z.string(),
  dniResponsable: z.string(),
  instagram: z.string().optional(),
  web: z.string().optional(),
  logo: z.string().optional(),
  tipoBeneficio: z.string(),
  porcentajeDescuento: z.coerce.number().min(0).max(100).optional().nullable(),
  productosIncluidos: z.string(),
  productosExcluidos: z.string().optional(),
  diasHorarios: z.string().optional(),
  condicionesEspeciales: z.string().optional(),
  topeUsosMensuales: z.coerce.number().min(0).optional().nullable(),
  estadoConvenio: z.enum(["activo", "pendiente", "vencido", "rescindido"]),
  fechaInicio: z.string(),
  fechaVencimiento: z.string(),
  renovacionAutomatica: z.boolean(),
});

type ComercioFormValues = z.infer<typeof comercioSchema>;

interface ComercioFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comercio: Comercio | null;
  onSuccess: () => void;
}

export function ComercioFormDialog({
  open,
  onOpenChange,
  comercio,
  onSuccess,
}: ComercioFormDialogProps) {
  const { app } = useFirebase();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const form = useForm<ComercioFormValues>({
    resolver: zodResolver(comercioSchema),
    defaultValues: {
      razonSocial: "",
      cuit: "",
      rubro: "",
      domicilio: "",
      localidad: "San Nicolás de los Arroyos",
      telefono: "",
      email: "",
      responsable: "",
      dniResponsable: "",
      instagram: "",
      web: "",
      logo: "",
      tipoBeneficio: "descuento",
      porcentajeDescuento: 10,
      productosIncluidos: "",
      productosExcluidos: "",
      diasHorarios: "",
      condicionesEspeciales: "",
      topeUsosMensuales: null,
      estadoConvenio: "activo",
      fechaInicio: new Date().toISOString().slice(0, 10),
      fechaVencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      renovacionAutomatica: false,
    },
  });

  useEffect(() => {
    if (comercio) {
      form.reset({
        razonSocial: comercio.razonSocial,
        cuit: comercio.cuit,
        rubro: comercio.rubro,
        domicilio: comercio.domicilio,
        localidad: comercio.localidad,
        telefono: comercio.telefono,
        email: comercio.email,
        responsable: comercio.responsable,
        dniResponsable: comercio.dniResponsable,
        instagram: comercio.instagram ?? "",
        web: comercio.web ?? "",
        logo: comercio.logo ?? "",
        tipoBeneficio: comercio.tipoBeneficio || "descuento",
        porcentajeDescuento: comercio.porcentajeDescuento ?? null,
        productosIncluidos: comercio.productosIncluidos ?? "",
        productosExcluidos: comercio.productosExcluidos ?? "",
        diasHorarios: comercio.diasHorarios ?? "",
        condicionesEspeciales: comercio.condicionesEspeciales ?? "",
        topeUsosMensuales: comercio.topeUsosMensuales ?? null,
        estadoConvenio: comercio.estadoConvenio,
        fechaInicio: comercio.fechaInicio?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        fechaVencimiento: comercio.fechaVencimiento?.slice(0, 10) ?? "",
        renovacionAutomatica: comercio.renovacionAutomatica ?? false,
      });
    } else {
      form.reset({
        razonSocial: "",
        cuit: "",
        rubro: "",
        domicilio: "",
        localidad: "San Nicolás de los Arroyos",
        telefono: "",
        email: "",
        responsable: "",
        dniResponsable: "",
        instagram: "",
        web: "",
        logo: "",
        tipoBeneficio: "descuento",
        porcentajeDescuento: 10,
        productosIncluidos: "",
        productosExcluidos: "",
        diasHorarios: "",
        condicionesEspeciales: "",
        topeUsosMensuales: null,
        estadoConvenio: "activo",
        fechaInicio: new Date().toISOString().slice(0, 10),
        fechaVencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        renovacionAutomatica: false,
      });
    }
  }, [comercio, form, open]);

  async function onSubmit(values: ComercioFormValues) {
    if (!app) return;
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken().catch(() => null);
    if (!token) return;

    setSaving(true);
    try {
      const payload = {
        razonSocial: values.razonSocial.trim(),
        cuit: values.cuit.trim(),
        rubro: values.rubro.trim(),
        domicilio: values.domicilio.trim(),
        localidad: values.localidad.trim(),
        telefono: values.telefono.trim(),
        email: values.email.trim(),
        responsable: values.responsable.trim(),
        dniResponsable: values.dniResponsable.trim(),
        instagram: values.instagram?.trim() || undefined,
        web: values.web?.trim() || undefined,
        logo: values.logo?.trim() || undefined,
        tipoBeneficio: values.tipoBeneficio.trim(),
        porcentajeDescuento: values.porcentajeDescuento ?? undefined,
        productosIncluidos: values.productosIncluidos.trim(),
        productosExcluidos: values.productosExcluidos?.trim() || undefined,
        diasHorarios: values.diasHorarios?.trim() || undefined,
        condicionesEspeciales: values.condicionesEspeciales?.trim() || undefined,
        topeUsosMensuales: values.topeUsosMensuales ?? null,
        estadoConvenio: values.estadoConvenio,
        fechaInicio: values.fechaInicio,
        fechaVencimiento: values.fechaVencimiento,
        renovacionAutomatica: values.renovacionAutomatica,
      };

      if (comercio) {
        const res = await fetch(`/api/admin/comercios/${comercio.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Error al actualizar");
        }
        toast({ title: "Comercio actualizado", description: "Los cambios se guardaron correctamente." });
      } else {
        const res = await fetch("/api/admin/comercios", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Error al crear");
        }
        toast({ title: "Comercio creado", description: "El comercio fue agregado correctamente." });
      }
      onSuccess();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo guardar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{comercio ? "Editar comercio" : "Nuevo comercio"}</DialogTitle>
          <DialogDescription>
            {comercio
              ? "Modificá los datos del comercio adherido."
              : "Completá los datos del nuevo comercio para Regatas+."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="razonSocial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Razón social *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cuit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CUIT *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="20-12345678-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rubro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rubro *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Gastronomía, Salud, etc." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estadoConvenio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado del convenio</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="vencido">Vencido</SelectItem>
                        <SelectItem value="rescindido">Rescindido</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipoBeneficio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de beneficio</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="descuento, 2x1, etc." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="porcentajeDescuento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>% Descuento (si aplica)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="domicilio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domicilio</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="localidad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localidad</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="responsable"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsable</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dniResponsable"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNI Responsable</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="productosIncluidos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Productos/servicios incluidos</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="condicionesEspeciales"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condiciones especiales</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fechaInicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha inicio convenio</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fechaVencimiento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha vencimiento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-crsn-orange hover:bg-crsn-orange-hover"
                disabled={saving}
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {comercio ? "Guardar cambios" : "Crear comercio"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
