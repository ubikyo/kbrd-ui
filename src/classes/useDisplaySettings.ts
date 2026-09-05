import { useEffect, useState } from "react";

import { getDisplay, updateDisplay } from "../api/display";
import { DEFAULT_LAYOUT_SETTINGS } from "../types/layout";
import type { LayoutSettings } from "../types/layout";

/**
 * Physical grid settings (Settings' own physical width/height, plus each
 * layout's Caps size / Gap size) as one bag of numbers, the shape
 * `<Display>`/`<LayoutEditorModal>` share regardless of where each field
 * is actually edited or persisted (see `LayoutSettings`). The physical
 * screen's width/height (`display`, see KBRD-API) are one row for the
 * whole device, loaded once here rather than re-seeded on every layout
 * switch the way Caps size / Gap size are (see `App`'s own `changeLayout`,
 * which folds a layout's `unit_mm`/`gap_mm` into `setLayoutSettings`
 * itself instead of going through this hook) — switching layouts must
 * never resize the physical screen out from under the display.
 */
export function useDisplaySettings() {
  const [layoutSettings, setLayoutSettings] = useState<LayoutSettings>(
    DEFAULT_LAYOUT_SETTINGS,
  );

  useEffect(() => {
    let cancelled = false;
    void getDisplay().then((data) => {
      if (cancelled) return;
      setLayoutSettings((current) => ({
        ...current,
        physicalWidthMm: data.physical_width_mm,
        physicalHeightMm: data.physical_height_mm,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveDisplaySettings(settings: LayoutSettings) {
    setLayoutSettings(settings);
    const updated = await updateDisplay({
      physical_width_mm: settings.physicalWidthMm,
      physical_height_mm: settings.physicalHeightMm,
    });
    setLayoutSettings((current) => ({
      ...current,
      physicalWidthMm: updated.physical_width_mm,
      physicalHeightMm: updated.physical_height_mm,
    }));
  }

  return { layoutSettings, setLayoutSettings, saveDisplaySettings };
}
