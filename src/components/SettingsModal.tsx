import { useEffect, useState } from "react";
import { Box, Button, Group, Modal, NumberInput, Stack, Tabs, Text, Title } from "@mantine/core";
import { MdStraighten } from "react-icons/md";

import { getDevice, type DeviceStatus } from "../api/device";

const DEFAULT_UNIT_MM = 19.05;
const DEVICE_POLL_INTERVAL_MS = 5000;
const MM_PER_INCH = 25.4;
// KBRD-DEV's reference panel (see kbrd_dev/config.py's calibration comment),
// used only to seed the field before the user confirms the real numbers.
const DEFAULT_PHYSICAL_WIDTH_MM = 216;
const DEFAULT_PHYSICAL_HEIGHT_MM = 135;

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
};

export default function SettingsModal({ opened, onClose }: Props) {
  const [tab, setTab] = useState<string | null>("geometry");
  const [savedUnit, setSavedUnit] = useState<number>(DEFAULT_UNIT_MM);
  const [unit, setUnit] = useState<number>(DEFAULT_UNIT_MM);
  // EDID doesn't report a physical size on every panel (KBRD-DEV's DSI
  // touchscreen included — `modetest -c` shows it, but the DRM connector
  // never surfaces it through the sysfs `edid` blob kbrd_dev.edid reads).
  // Since DPI and the max key count both depend on it, these two are a
  // mandatory manual fallback rather than something read from the device.
  const [savedPhysicalWidthMm, setSavedPhysicalWidthMm] = useState<number>(
    DEFAULT_PHYSICAL_WIDTH_MM,
  );
  const [physicalWidthMm, setPhysicalWidthMm] = useState<number>(
    DEFAULT_PHYSICAL_WIDTH_MM,
  );
  const [savedPhysicalHeightMm, setSavedPhysicalHeightMm] = useState<number>(
    DEFAULT_PHYSICAL_HEIGHT_MM,
  );
  const [physicalHeightMm, setPhysicalHeightMm] = useState<number>(
    DEFAULT_PHYSICAL_HEIGHT_MM,
  );
  const [device, setDevice] = useState<DeviceStatus>({ connected: false });

  // Reset the draft to the last saved values whenever the modal opens back up.
  const [wasOpened, setWasOpened] = useState(opened);
  if (opened !== wasOpened) {
    setWasOpened(opened);
    if (opened) {
      setUnit(savedUnit);
      setPhysicalWidthMm(savedPhysicalWidthMm);
      setPhysicalHeightMm(savedPhysicalHeightMm);
    }
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

  function cancel() {
    setUnit(savedUnit);
    setPhysicalWidthMm(savedPhysicalWidthMm);
    setPhysicalHeightMm(savedPhysicalHeightMm);
    onClose();
  }

  function save() {
    setSavedUnit(unit);
    setSavedPhysicalWidthMm(physicalWidthMm);
    setSavedPhysicalHeightMm(physicalHeightMm);
    onClose();
  }

  const hasValidPhysicalSize = physicalWidthMm > 0 && physicalHeightMm > 0;

  const resolutionValue = device.connected
    ? `${device.width} × ${device.height} px`
    : "—";
  const dpiValue =
    device.connected && hasValidPhysicalSize
      ? `${Math.round(device.width / (physicalWidthMm / MM_PER_INCH))} × ${Math.round(
          device.height / (physicalHeightMm / MM_PER_INCH),
        )} dpi`
      : "—";
  const maxKeysValue =
    hasValidPhysicalSize && unit > 0
      ? `${Math.floor(physicalWidthMm / unit)} × ${Math.floor(physicalHeightMm / unit)}`
      : "—";

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
                  value={unit}
                  success
                  onChange={(value) =>
                    setUnit(typeof value === "number" ? value : DEFAULT_UNIT_MM)
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
                  value={physicalWidthMm}
                  error={physicalWidthMm > 0 ? undefined : "Required"}
                  success={physicalWidthMm > 0}
                  onChange={(value) =>
                    setPhysicalWidthMm(typeof value === "number" ? value : 0)
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
                  value={physicalHeightMm}
                  error={physicalHeightMm > 0 ? undefined : "Required"}
                  success={physicalHeightMm > 0}
                  onChange={(value) =>
                    setPhysicalHeightMm(typeof value === "number" ? value : 0)
                  }
                />
              </FieldRow>

              <Title order={4} mt="md">Display</Title>
              <DisplayRow label="Resolution (px)" value={resolutionValue} />
              <DisplayRow label="DPI (x / y)" value={dpiValue} />
              <DisplayRow label="Max keys (W × H)" value={maxKeysValue} />
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
