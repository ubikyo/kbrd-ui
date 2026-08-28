import { useEffect, useState } from "react";
import { Box, Button, Group, Modal, NumberInput, Stack, Tabs, Text, Title } from "@mantine/core";
import { MdStraighten } from "react-icons/md";

import { getDevice, type DeviceStatus } from "../api/device";
import type { LayoutSettings } from "../types/layout";
import { maxItems, pitchMm } from "../utils/layout";

const DEVICE_POLL_INTERVAL_MS = 5000;
const MM_PER_INCH = 25.4;

type FieldRowProps = {
  label: string;
  children: React.ReactNode;
};

/** Same 40/60 label/control split for every field in this modal. */
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
  opened: boolean;
  onClose: () => void;
  settings: LayoutSettings;
  onSave: (settings: LayoutSettings) => void;
};

export default function SettingsModal({
  opened,
  onClose,
  settings,
  onSave,
}: Props) {
  const [tab, setTab] = useState<string | null>("geometry");
  const [draft, setDraft] = useState<LayoutSettings>(settings);
  const [device, setDevice] = useState<DeviceStatus>({ connected: false });

  // Reset the draft to the last saved values whenever the modal opens back up.
  const [wasOpened, setWasOpened] = useState(opened);
  if (opened !== wasOpened) {
    setWasOpened(opened);
    if (opened) setDraft(settings);
  }

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    function poll() {
      getDevice().then(
        (status) => {
          if (!cancelled) setDevice(status);
        },
        () => {},
      );
    }
    poll();
    const timer = window.setInterval(poll, DEVICE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [opened]);

  function patch(data: Partial<LayoutSettings>) {
    setDraft((current) => ({ ...current, ...data }));
  }

  function cancel() {
    setDraft(settings);
    onClose();
  }

  function save() {
    onSave(draft);
    onClose();
  }

  const hasValidPhysicalSize =
    draft.physicalWidthMm > 0 && draft.physicalHeightMm > 0;

  const resolutionValue = device.connected
    ? `${device.width} × ${device.height} px`
    : "—";
  const dpiValue =
    device.connected && hasValidPhysicalSize
      ? `${Math.round(device.width / (draft.physicalWidthMm / MM_PER_INCH))} × ${Math.round(
          device.height / (draft.physicalHeightMm / MM_PER_INCH),
        )} dpi`
      : "—";
  const pitch = pitchMm(draft.unitMm, draft.gapMm);
  const maxItemsValue = hasValidPhysicalSize
    ? `${maxItems(draft.physicalWidthMm, draft.unitMm, draft.gapMm)} × ${maxItems(
        draft.physicalHeightMm,
        draft.unitMm,
        draft.gapMm,
      )}`
    : "—";
  const pitchValue = pitch > 0 ? `${pitch.toFixed(2)} mm` : "—";

  return (
    <Modal
      opened={opened}
      onClose={cancel}
      title={<Text fw={700}>Settings</Text>}
      centered
      size="lg"
      overlayProps={{ backgroundOpacity: 0.65, blur: 2 }}
      styles={{
        content: {
          display: "flex",
          flexDirection: "column",
          height: "70vh",
        },
        body: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0, padding: 0 },
      }}
    >
      <Box style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
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
        >
          <Tabs.List w={180} style={{ flexShrink: 0 }}>
            <Tabs.Tab value="geometry" leftSection={<MdStraighten size={16} />}>
              Geometry
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel
            value="geometry"
            px="lg"
            pb="lg"
            style={{ overflowY: "auto" }}
          >
            <Stack gap="md">
              <Title order={4}>Geometry</Title>
              <FieldRow label="Unit (1U)">
                <NumberInput
                  w="100%"
                  aria-label="Unit (1U)"
                  suffix=" mm"
                  min={0}
                  step={0.05}
                  decimalScale={2}
                  fixedDecimalScale
                  value={draft.unitMm}
                  success
                  onChange={(value) =>
                    patch({ unitMm: typeof value === "number" ? value : 0 })
                  }
                />
              </FieldRow>
              <FieldRow label="Physical width (mm)">
                <NumberInput
                  w="100%"
                  aria-label="Physical width (mm)"
                  suffix=" mm"
                  min={1}
                  step={1}
                  required
                  value={draft.physicalWidthMm}
                  error={draft.physicalWidthMm > 0 ? undefined : "Required"}
                  success={draft.physicalWidthMm > 0}
                  onChange={(value) =>
                    patch({
                      physicalWidthMm: typeof value === "number" ? value : 0,
                    })
                  }
                />
              </FieldRow>
              <FieldRow label="Physical height (mm)">
                <NumberInput
                  w="100%"
                  aria-label="Physical height (mm)"
                  suffix=" mm"
                  min={1}
                  step={1}
                  required
                  value={draft.physicalHeightMm}
                  error={draft.physicalHeightMm > 0 ? undefined : "Required"}
                  success={draft.physicalHeightMm > 0}
                  onChange={(value) =>
                    patch({
                      physicalHeightMm: typeof value === "number" ? value : 0,
                    })
                  }
                />
              </FieldRow>
              <FieldRow label="Gap">
                <NumberInput
                  w="100%"
                  aria-label="Gap"
                  suffix=" mm"
                  min={0}
                  step={0.5}
                  decimalScale={2}
                  value={draft.gapMm}
                  success
                  onChange={(value) =>
                    patch({ gapMm: typeof value === "number" ? value : 0 })
                  }
                />
              </FieldRow>

              <Title order={4} mt="md">Display</Title>
              <DisplayRow label="Resolution (px)" value={resolutionValue} />
              <DisplayRow label="DPI (x / y)" value={dpiValue} />
              <DisplayRow label="Max items" value={maxItemsValue} />
              <DisplayRow label="Pitch" value={pitchValue} />
            </Stack>
          </Tabs.Panel>
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
        <Button color="gray" onClick={cancel}>Cancel</Button>
        <Button onClick={save} disabled={!hasValidPhysicalSize}>Save</Button>
      </Group>
    </Modal>
  );
}
