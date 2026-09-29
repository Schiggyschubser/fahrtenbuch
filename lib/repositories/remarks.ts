import { ensureDatabaseReady, sqlite } from "../db";
import type { RemarkSettingsDto } from "../types";
import { remarkSettingsSchema } from "../validation";
import type { z } from "zod";

export function getRemarkSettings(): RemarkSettingsDto {
  ensureDatabaseReady();
  const templates = sqlite.prepare("SELECT id, text FROM remark_templates ORDER BY id").all() as RemarkSettingsDto["templates"];
  const settings = sqlite.prepare("SELECT default_remark_template_id AS id FROM app_settings WHERE id = 1").get() as { id: number | null };
  return { templates, defaultTemplateId: templates.some((template) => template.id === settings.id) ? settings.id : null };
}

export function updateRemarkSettings(raw: z.input<typeof remarkSettingsSchema>): RemarkSettingsDto {
  const input = remarkSettingsSchema.parse(raw);
  ensureDatabaseReady();
  sqlite.transaction(() => {
    const existing = new Set(getRemarkSettings().templates.map((template) => template.id));
    const supplied = input.templates.flatMap((template) => template.id === undefined ? [] : [template.id]);
    if (new Set(supplied).size !== supplied.length || supplied.some((id) => !existing.has(id))) {
      throw new Error("Ungültige Bemerkungsvorlage. Bitte die Einstellungen neu laden.");
    }
    const ids = input.templates.map((template) => {
      if (template.id !== undefined) {
        sqlite.prepare("UPDATE remark_templates SET text = ? WHERE id = ?").run(template.text, template.id);
        return template.id;
      }
      return Number(sqlite.prepare("INSERT INTO remark_templates (text) VALUES (?)").run(template.text).lastInsertRowid);
    });
    for (const id of existing) if (!ids.includes(id)) sqlite.prepare("DELETE FROM remark_templates WHERE id = ?").run(id);
    sqlite.prepare("UPDATE app_settings SET default_remark_template_id = ?, updated_at = ? WHERE id = 1")
      .run(input.defaultTemplateIndex === null ? null : ids[input.defaultTemplateIndex], new Date().toISOString());
  })();
  return getRemarkSettings();
}
