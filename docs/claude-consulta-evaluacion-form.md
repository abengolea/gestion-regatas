# Código para Claude – Bug validación Comentarios Generales

## 1. Schema de Zod actual

```ts
const evaluationSchema = z.object({
  position: z.enum(["delantero", "mediocampo", "defensor", "arquero"]).optional(),
  // Validación de coachComments se hace manualmente en onSubmit (evita desincronía estado/DOM)
  coachComments: z.string().optional().default(""),
  rubricComments: z.record(z.string()).optional().default({}),
  // ... resto: control, pase, definicion, etc. con .default(5)
  control: z.number().min(1).max(10).default(5),
  pase: z.number().min(1).max(10).default(5),
  // ... etc
});
```

## 2. useForm y apertura/cierre del Sheet

```tsx
// Props del componente
interface AddEvaluationSheetProps {
  socioId: string;
  subcomisionId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  playerName?: string;
  evaluationsSummary?: EvaluationSummaryForAI[];
  editingEvaluation?: Evaluation | null;
}

// Dentro del componente
const form = useForm<EvaluationFormValues>({
  resolver: zodResolver(evaluationSchema),
  defaultValues: defaultFormValues, // coachComments: ""
});

// Solo resetear al abrir el sheet (no mientras está abierto)
const prevOpenRef = React.useRef(false);
React.useEffect(() => {
  const justOpened = isOpen && !prevOpenRef.current;
  prevOpenRef.current = isOpen;
  if (!justOpened) return;
  if (editingEvaluation) {
    form.reset(getDefaultValuesFromEvaluation(editingEvaluation));
  } else {
    form.reset(defaultFormValues);
  }
}, [isOpen, editingEvaluation?.id]);
```

**Uso del Sheet:** El padre controla `isOpen` y `onOpenChange`. Ejemplo típico: estado `const [sheetOpen, setSheetOpen] = useState(false)` y `<AddEvaluationSheet isOpen={sheetOpen} onOpenChange={setSheetOpen} ... />`. Al abrir el sheet se llama `onOpenChange(true)`; al cerrar, `onOpenChange(false)`.

## 3. onSubmit (validación manual de coachComments + guardado)

```tsx
async function onSubmit(values: EvaluationFormValues) {
  if (!profile) {
    toast({ variant: "destructive", title: "Error de Perfil", ... });
    return;
  }

  // Validación manual: estado y, si viene vacío, valor del DOM
  let coachComments = (values.coachComments ?? "").trim();
  if (!coachComments && coachCommentsRef.current?.value) {
    coachComments = (coachCommentsRef.current.value ?? "").trim();
    if (coachComments) form.setValue("coachComments", coachCommentsRef.current.value);
  }
  if (!coachComments) {
    toast({
      variant: "destructive",
      title: "Completa los datos",
      description: "Los Comentarios Generales del Entrenador son obligatorios. Escribí al menos un carácter (no solo espacios).",
    });
    return;
  }

  const { position, rubricComments, ...ratings } = values;
  // ... armar payload con coachComments (la variable), position, technical, tactical, socioEmotional
  // ... addDoc o updateDoc, toast, form.reset(), onOpenChange(false)
}
```

## 4. onInvalid (callback cuando falla la validación del resolver)

Se usa como segundo argumento de `handleSubmit`:

```tsx
form.handleSubmit(onSubmit, (errors) => {
  const coachMsg = errors.coachComments?.message;
  const description = coachMsg
    ? "Escribí algo en «Comentarios Generales del Entrenador». ..."
    : (Object.values(errors)[0]?.message ?? "Solo los Comentarios Generales del Entrenador son obligatorios.");
  toast({ variant: "destructive", title: "Completa los datos", description });
})();
```

Como `coachComments` está como `optional().default("")`, el resolver no debería fallar por ese campo; el toast de “Completa los datos” puede venir de `onSubmit` (validación manual) cuando `coachComments` y el DOM están vacíos.

## 5. Botón Guardar (con logs de diagnóstico)

```tsx
<Button
  type="button"
  disabled={form.formState.isSubmitting}
  onClick={() => {
    console.log("🔍 Estado form:", {
      values: form.getValues(),
      coachComments: form.getValues("coachComments"),
      errors: form.formState.errors,
      isDirty: form.formState.isDirty,
      dirtyFields: form.formState.dirtyFields,
      touchedFields: form.formState.touchedFields,
      isValid: form.formState.isValid,
    });
    console.log("🔍 DOM textarea:", coachCommentsRef.current?.value);

    form.handleSubmit(onSubmit, (errors) => {
      // ... toast onInvalid
    })();
  }}
>
  {form.formState.isSubmitting ? "Guardando..." : "Guardar Evaluación"}
</Button>
```

## 6. Campo coachComments (Textarea con register + ref)

```tsx
const coachCommentsRef = useRef<HTMLTextAreaElement | null>(null);

// En el JSX (dentro del <form>):
{(() => {
  const { ref: regRef, ...regRest } = form.register("coachComments", {
    setValueAs: (v) => (typeof v === "string" ? v : ""),
  });
  return (
    <Textarea
      id="coachComments"
      placeholder="..."
      className="min-h-[120px]"
      {...regRest}
      ref={(el) => {
        coachCommentsRef.current = el;
        if (typeof regRef === "function") regRef(el);
        else if (regRef) (regRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      }}
    />
  );
})()}
```

El `<form>` está dentro de `<ScrollArea>`; el botón Guardar está en `<SheetFooter>`, fuera del `<form>`. El Sheet usa Radix Dialog (portal).

## 7. Estructura JSX del Sheet (resumida)

```tsx
<Sheet open={isOpen} onOpenChange={onOpenChange}>
  <SheetContent className="sm:max-w-xl w-full flex flex-col">
    <SheetHeader>...</SheetHeader>
    <ScrollArea className="flex-1 -mx-6 px-6">
      <Form {...form}>
        <form id="add-evaluation-form" onSubmit={form.handleSubmit(onSubmit)} className="...">
          {/* Posición, habilidades técnicas/tácticas/socioemocionales (FormField + StarRating + RubricCommentField) */}
          {/* Bloque coachComments: Label + Textarea con register + ref (arriba) */}
        </form>
      </Form>
    </ScrollArea>
    <SheetFooter className="pt-4 border-t">
      <SheetClose asChild><Button type="button" variant="outline">Cancelar</Button></SheetClose>
      <Button type="button" ... onClick={...}>Guardar Evaluación</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

---

---

## 8. Logs de diagnóstico actuales (para Claude)

Al hacer clic en Guardar se ejecuta:

```tsx
// Antes de handleSubmit:
console.log("🔍 Errores completos:", form.formState.errors);
console.log("🔍 Error específico coachComments:", form.formState.errors.coachComments);
// Luego: sync DOM → form si difieren, y form.handleSubmit(onSubmit, onInvalid)();
```

**Dentro de onSubmit** (solo si la validación del resolver pasa):
```tsx
console.log("✅ DENTRO de onSubmit - valores recibidos:", values);
console.log("✅ coachComments específico:", values.coachComments);
```

**Dentro de onInvalid** (solo si la validación del resolver falla):
```tsx
console.log("❌ VALIDACIÓN FALLÓ - errores:", errors);
```

Interpretación:
- Si ves **❌ VALIDACIÓN FALLÓ** → el resolver (Zod) está rechazando algo; revisar `errors` y el schema.
- Si ves **✅ DENTRO de onSubmit** → el resolver pasó; si aun así aparece el toast "Completa los datos", viene del `if (!coachComments)` dentro de `onSubmit`.

---

**Código completo del componente:** `src/components/evaluations/AddEvaluationSheet.tsx` (aprox. 820 líneas). Puedes abrir ese archivo y copiarlo para Claude.
