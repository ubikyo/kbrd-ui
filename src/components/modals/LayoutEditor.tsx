import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { MdInfoOutline, MdStraighten } from "react-icons/md";

import { getDisplay } from "../../api/display";
import { createLayout, duplicateLayout, updateLayout } from "../../api/layouts";
import { DEFAULT_LAYOUT_SETTINGS } from "../../types/layout";
import type { DisplayData, LayoutData, LayoutPayload } from "../../types/layout";
import { maxItems, pitchMm } from "../../utils/layout";

type FieldRowProps = {
  label: string;
  children: React.ReactNode;
};

/** Same 40/60 label/control split as `Settings`'s own fields — this
 * modal shares its tabbed, settings-style layout. */
function FieldRow({ label, children }: FieldRowProps) {
  return (
    <Box
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 4fr) minmax(0, 6fr)",
        columnGap: "var(--mantine-spacing-md)",
        alignItems: "center",
      }}
    >
      <Text size="sm">{label}</Text>
      {children}
    </Box>
  );
}

function DisplayRow({ label, value }: { label: string; value: string }) {
  return (
    <FieldRow label={label}>
      <Text size="sm" c="dimmed">
        {value}
      </Text>
    </FieldRow>
  );
}

type Props = {
  editing: LayoutData | null;
  // Set (with `editing` null) to open this as "Duplicate" instead of
  // "Add" — prefills Name/Description from this source and, on save,
  // clones its geometry/settings server-side (see `duplicateLayout`)
  // rather than starting from a blank layout. Geometry isn't editable in
  // this mode (see the Geometry tab below): `duplicateLayout` always
  // carries the source's own over unchanged, so exposing fields that
  // wouldn't actually apply would be misleading.
  duplicateFrom: LayoutData | null;
  onClose: () => void;
  onSaved: (id: number) => void;
};

export default function LayoutEditor({
  editing,
  duplicateFrom,
  onClose,
  onSaved,
}: Props) {
  const [tab, setTab] = useState<string | null>("general");
  const [name, setName] = useState(
    editing?.name ?? (duplicateFrom ? `${duplicateFrom.name} copy` : ""),
  );
  const [description, setDescription] = useState(
    editing?.description ?? duplicateFrom?.description ?? "",
  );
  const [author, setAuthor] = useState(editing?.author ?? "");
  // Caps size / Gap size — per-layout, like the rest of Settings ›
  // Geometry, just edited here instead since they live on this same form.
  const [capsMm, setCapsMm] = useState(
    editing?.unit_mm ?? DEFAULT_LAYOUT_SETTINGS.unitMm,
  );
  const [gapMm, setGapMm] = useState(
    editing?.gap_mm ?? DEFAULT_LAYOUT_SETTINGS.gapMm,
  );
  const [error, setError] = useState("");
  // The physical screen's width/height (`display`, see App) aren't edited
  // here — Caps/Gap size are — but Max width/height still need them, so
  // this reads them once just to compute that Display section's rows.
  const [display, setDisplay] = useState<DisplayData | null>(null);
  // `null` until `display` loads, or if this is a brand-new layout with no
  // override yet — the fields below fall back to the *computed* max
  // (`maxColumns`/`maxRows`) while this stays null, exactly like Caps
  // size/Gap size fall back to `DEFAULT_LAYOUT_SETTINGS`.
  const [maxColumnsOverride, setMaxColumnsOverride] = useState(
    editing?.max_columns ?? null,
  );
  const [maxRowsOverride, setMaxRowsOverride] = useState(
    editing?.max_rows ?? null,
  );

  useEffect(() => {
    let cancelled = false;
    void getDisplay().then((data) => {
      if (!cancelled) setDisplay(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // How many 1U reference items actually fit, given the display's physical
  // size and this layout's own Caps/Gap size — the ceiling neither field
  // below can exceed (see `maxColumns`/`gridItemsY` in `Display`/`App`,
  // which clamp to this same computation independently).
  const computedMaxColumns = display
    ? maxItems(display.physical_width_mm, capsMm, gapMm)
    : null;
  const computedMaxRows = display
    ? maxItems(display.physical_height_mm, capsMm, gapMm)
    : null;

  // Clamped on read rather than written back into the override itself —
  // keeps a stored override from silently exceeding a *shrunk* computed
  // max (e.g. Caps size just got bigger), without needing an effect to
  // pull the stored value back down on every render that would otherwise
  // exceed it.
  const maxColumnsValue =
    maxColumnsOverride != null && computedMaxColumns != null
      ? Math.min(maxColumnsOverride, computedMaxColumns)
      : (maxColumnsOverride ?? computedMaxColumns);
  const maxRowsValue =
    maxRowsOverride != null && computedMaxRows != null
      ? Math.min(maxRowsOverride, computedMaxRows)
      : (maxRowsOverride ?? computedMaxRows);

  async function save() {
    const payload: LayoutPayload = {
      name: name.trim(),
      description: description.trim(),
      author: author.trim(),
      // Positioning now lives in Layout mode, not this form — keep
      // whatever was already stored, or start empty for a brand-new layout.
      unit: editing?.unit ?? "mm",
      geometry: editing?.geometry ?? [],
      unit_mm: capsMm,
      gap_mm: gapMm,
      max_columns: maxColumnsValue,
      max_rows: maxRowsValue,
    };
    if (!payload.name) return;

    try {
      const saved = editing
        ? await updateLayout(editing.id, payload)
        : duplicateFrom
          ? await duplicateLayout(duplicateFrom.id, {
              name: payload.name,
              description: payload.description,
            })
          : await createLayout(payload);
      onSaved(saved.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save layout.",
      );
    }
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title={
        <Text fw={700}>
          {editing ? "Edit" : duplicateFrom ? "Duplicate" : "Add"} layout
        </Text>
      }
      centered
      size={670}
      overlayProps={{ backgroundOpacity: 0.65, blur: 2 }}
      styles={{
        content: {
          display: "flex",
          flexDirection: "column",
          height: "calc(70vh + 50px)",
          backgroundColor: "var(--kbrd-color-body)",
        },
        header: { backgroundColor: "var(--kbrd-color-body)" },
        body: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0, padding: 0 },
      }}
    >
      <Box
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          padding: "24px 40px 40px",
        }}
      >
        <Tabs
          value={tab}
          onChange={setTab}
          orientation="vertical"
          variant="outline"
          style={
            {
              height: "100%",
              "--tab-border-color": "var(--kbrd-border-color)",
            } as React.CSSProperties
          }
          styles={{
            tabLabel: { textAlign: "left" },
          }}
        >
          <Tabs.List w={180} style={{ flexShrink: 0 }}>
            <Tabs.Tab value="general" leftSection={<MdInfoOutline size={16} />}>
              General
            </Tabs.Tab>
            {!duplicateFrom && (
              <Tabs.Tab value="geometry" leftSection={<MdStraighten size={16} />}>
                Geometry
              </Tabs.Tab>
            )}
          </Tabs.List>

          <Tabs.Panel
            value="general"
            style={{ overflowY: "auto", padding: 0, paddingLeft: 40 }}
          >
            <Stack gap="md">
              <Title order={4}>General</Title>
              <TextInput
                variant="filled"
                label="Name"
                value={name}
                error={!name.trim() ? "Name is required" : undefined}
                success={Boolean(name.trim())}
                onChange={(event) => setName(event.currentTarget.value)}
                required
              />
              {!duplicateFrom && (
                <TextInput
                  variant="filled"
                  label="Author"
                  value={author}
                  success
                  onChange={(event) => setAuthor(event.currentTarget.value)}
                />
              )}
              <Textarea
                variant="filled"
                label="Description"
                value={description}
                success
                onChange={(event) => setDescription(event.currentTarget.value)}
                autosize
                minRows={2}
                maxRows={4}
              />
              {error && (
                <Text size="sm" c="red">
                  {error}
                </Text>
              )}
            </Stack>
          </Tabs.Panel>

          {!duplicateFrom && (
          <Tabs.Panel
            value="geometry"
            style={{ overflowY: "auto", padding: 0, paddingLeft: 40 }}
          >
            <Stack gap="md">
              <Title order={4}>Geometry</Title>
              <FieldRow label="Caps size">
                <NumberInput
                  w="100%"
                  aria-label="Caps size"
                  suffix=" mm"
                  min={0}
                  step={0.5}
                  decimalScale={2}
                  value={capsMm}
                  success
                  onChange={(value) =>
                    setCapsMm(typeof value === "number" ? value : 0)
                  }
                />
              </FieldRow>
              <FieldRow label="Gap size">
                <NumberInput
                  w="100%"
                  aria-label="Gap size"
                  suffix=" mm"
                  min={0}
                  step={0.5}
                  decimalScale={2}
                  value={gapMm}
                  success
                  onChange={(value) =>
                    setGapMm(typeof value === "number" ? value : 0)
                  }
                />
              </FieldRow>

              <Title order={4} mt="md">Display</Title>
              <DisplayRow
                label="Pitch (1U)"
                value={
                  pitchMm(capsMm, gapMm) > 0
                    ? `${pitchMm(capsMm, gapMm).toFixed(2)} mm`
                    : "—"
                }
              />
              <FieldRow label="Max width (1U)">
                <NumberInput
                  w="100%"
                  aria-label="Max width (1U)"
                  min={1}
                  max={computedMaxColumns ?? undefined}
                  step={0.25}
                  decimalScale={2}
                  disabled={computedMaxColumns == null}
                  value={maxColumnsValue ?? ""}
                  success
                  onChange={(value) =>
                    setMaxColumnsOverride(typeof value === "number" ? value : null)
                  }
                />
              </FieldRow>
              <FieldRow label="Max height (1U)">
                <NumberInput
                  w="100%"
                  aria-label="Max height (1U)"
                  min={1}
                  max={computedMaxRows ?? undefined}
                  step={0.25}
                  decimalScale={2}
                  disabled={computedMaxRows == null}
                  value={maxRowsValue ?? ""}
                  success
                  onChange={(value) =>
                    setMaxRowsOverride(typeof value === "number" ? value : null)
                  }
                />
              </FieldRow>
            </Stack>
          </Tabs.Panel>
          )}
        </Tabs>
      </Box>

      <Group
        justify="flex-end"
        p="md"
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--kbrd-border-color)",
        }}
      >
        <Button color="gray" onClick={onClose}>Cancel</Button>
        <Button color="green" onClick={save} disabled={!name.trim()}>
          {editing ? "Save" : duplicateFrom ? "Duplicate" : "Add"}
        </Button>
      </Group>
    </Modal>
  );
}
