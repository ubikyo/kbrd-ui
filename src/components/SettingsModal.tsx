import { useEffect, useState } from "react";
import { Box, Button, Group, Modal, NumberInput, Stack, Tabs, Text, Title } from "@mantine/core";
import { MdStraighten } from "react-icons/md";

import { getDevice, type DeviceStatus } from "../api/device";

const DEFAULT_UNIT_MM = 19.05;
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
};

export default function SettingsModal({ opened, onClose }: Props) {
  const [tab, setTab] = useState<string | null>("geometry");
  const [savedUnit, setSavedUnit] = useState<number>(DEFAULT_UNIT_MM);
  const [unit, setUnit] = useState<number>(DEFAULT_UNIT_MM);
  const [device, setDevice] = useState<DeviceStatus>({ connected: false });

  // Reset the draft to the last saved value whenever the modal opens back up.
  const [wasOpened, setWasOpened] = useState(opened);
  if (opened !== wasOpened) {
    setWasOpened(opened);
    if (opened) setUnit(savedUnit);
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
    onClose();
  }

  function save() {
    setSavedUnit(unit);
    onClose();
  }

  const hasPhysicalSize =
    device.connected && device.width_mm !== null && device.height_mm !== null;

  const resolutionValue = device.connected
    ? `${device.width} × ${device.height} px`
    : "—";
  const physicalSizeValue = hasPhysicalSize
    ? `${device.width_mm} × ${device.height_mm} mm`
    : "—";
  const dpiValue =
    hasPhysicalSize && device.connected
      ? `${Math.round(device.width / (device.width_mm! / MM_PER_INCH))} × ${Math.round(
          device.height / (device.height_mm! / MM_PER_INCH),
        )} dpi`
      : "—";
  const maxKeysValue =
    hasPhysicalSize && device.connected && unit > 0
      ? `${Math.floor(device.width_mm! / unit)} × ${Math.floor(device.height_mm! / unit)}`
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

              <Title order={4} mt="md">Display</Title>
              <DisplayRow label="Resolution (px)" value={resolutionValue} />
              <DisplayRow label="Physical size (mm)" value={physicalSizeValue} />
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
        <Button onClick={save}>Save</Button>
      </Group>
    </Modal>
  );
}
