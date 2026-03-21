/**
 * Script de migración Regatas+ → Regatas+
 * Aplica find & replace global en el orden correcto.
 */
import * as fs from "fs";
import * as path from "path";

const ROOT = path.join(__dirname, "..");
const EXCLUDE = ["node_modules", ".next", ".git", "dist", "build", "scripts/migrate-to-regatas.ts"];

const REPLACEMENTS: [string | RegExp, string][] = [
  ["Escuelas River", "Regatas+"],
  ["regatas-plus", "regatas-plus"],
  ["Presidente de Subcomisión", "Presidente de Subcomisión"],
  ["admin_subcomision", "admin_subcomision"],
  ["Gerente del Club", "Gerente del Club"],
  ["gerente_club", "gerente_club"],
  ["Encargado Deportivo", "Encargado Deportivo"],
  [/\bcoach\b/g, "encargado_deportivo"],
  ["pendingSocioByEmail", "pendingSocioByEmail"],
  ["socioLogins", "socioLogins"],
  ["socioVideos", "socioVideos"],
  ["SocioVideo", "SocioVideo"],
  ["socioData", "socioData"],
  ["pendingSocios", "pendingSocios"],
  ["subcomisiones", "subcomisiones"],
  ["subcomisionId", "subcomisionId"],
  ["subcomisionSlug", "subcomisionSlug"],
  ["SubcomisionUser", "SubcomisionUser"],
  ["SubcomisionMembership", "SubcomisionMembership"],
  ["ClubFee", "ClubFee"],
  ["clubFee", "clubFee"],
  [/\bSchool\b/g, "Subcomision"],
  ["socios", "socios"],
  ["socioId", "socioId"],
  [/\bPlayer\b/g, "Socio"],
  ["SubcomisionUsers", "SubcomisionUsers"],
  ["CreateSubcomision", "CreateSubcomision"],
  ["EditSubcomision", "EditSubcomision"],
  ["AddSubcomision", "AddSubcomision"],
  ["SubcomisionUsersList", "SubcomisionUsersList"],
  ["EditSubcomisionUser", "EditSubcomisionUser"],
  ["AddSubcomisionUser", "AddSubcomisionUser"],
  ["CreateSubcomisionDialog", "CreateSubcomisionDialog"],
  ["EditSubcomisionDialog", "EditSubcomisionDialog"],
  ["SubcomisionAdmin", "SubcomisionAdmin"],
  ["ClubFeeBanner", "ClubFeeBanner"],
  ["ClubFeeConfig", "ClubFeeConfig"],
  ["clubFeeConfig", "clubFeeConfig"],
  ["clubFeePayments", "clubFeePayments"],
  ["ClubFeePayments", "ClubFeePayments"],
  ["verify-subcomision", "verify-subcomision"],
];

function shouldProcess(filePath: string): boolean {
  const rel = path.relative(ROOT, filePath);
  if (EXCLUDE.some((e) => rel.includes(e))) return false;
  const ext = path.extname(filePath);
  return [".ts", ".tsx", ".js", ".jsx", ".json", ".yaml", ".yml", ".mdc", ".md", ".rules"].includes(ext);
}

function processFile(filePath: string): boolean {
  let content = fs.readFileSync(filePath, "utf-8");
  let changed = false;
  for (const [from, to] of REPLACEMENTS) {
    const before = content;
    content = content.replace(from as string | RegExp, to);
    if (content !== before) changed = true;
  }
  if (changed) {
    fs.writeFileSync(filePath, content, "utf-8");
    console.log("Updated:", path.relative(ROOT, filePath));
  }
  return changed;
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDE.includes(entry.name)) {
        files.push(...walk(full));
      }
    } else if (entry.isFile() && shouldProcess(full)) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(ROOT);
let count = 0;
for (const f of files) {
  if (processFile(f)) count++;
}
console.log(`\nDone. Updated ${count} files.`);
