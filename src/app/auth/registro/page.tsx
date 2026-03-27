"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Users, Trophy } from "lucide-react";

export default function RegistroPage() {
  return (
    <div className="w-full max-w-2xl space-y-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-headline font-bold text-crsn-text-dark uppercase mb-2">
          Crear cuenta
        </h1>
        <p className="text-muted-foreground">
          Elegí el tipo de registro según tu perfil
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/auth/registro/socio" className="block">
          <Card className="h-full hover:border-crsn-orange hover:shadow-md transition-all cursor-pointer">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-crsn-orange/20 flex items-center justify-center mb-2">
                <Users className="h-6 w-6 text-crsn-orange" />
              </div>
              <CardTitle className="text-lg font-headline">Socio</CardTitle>
              <CardDescription>
                Asociate al Club de Regatas y accedé a beneficios exclusivos con Regatas+.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/auth/registro/jugador" className="block">
          <Card className="h-full hover:border-crsn-orange hover:shadow-md transition-all cursor-pointer">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-crsn-orange/20 flex items-center justify-center mb-2">
                <Trophy className="h-6 w-6 text-crsn-orange" />
              </div>
              <CardTitle className="text-lg font-headline">Jugador</CardTitle>
              <CardDescription>
                Inscribite en una escuela deportiva del club. Un administrador revisará tu solicitud.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <p className="text-center text-sm text-muted-foreground mt-6">
        ¿Ya tenés cuenta?{" "}
        <Link href="/auth/login" className="underline">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
