import { useState } from "react";
import { Modal, NumberInput, Stack, Tabs, Text, Title } from "@mantine/core";
import { MdStraighten } from "react-icons/md";
import { PropertyRow } from "@kbrd/plugins/web";

const DEFAULT_UNIT_MM = 19.05;

type Props = {
  opened: boolean;
  onClose: () => void;
};

export default function SettingsModal({ opened, onClose }: Props) {
  const [tab, setTab] = useState<string | null>("geometry");
  const [unit, setUnit] = useState<number>(DEFAULT_UNIT_MM);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
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
        body: { display: "flex", flex: 1, minHeight: 0, padding: 0 },
      }}
    >
      <Tabs
        value={tab}
        onChange={setTab}
        orientation="vertical"
        style={{ flex: 1, minHeight: 0 }}
      >
        <Tabs.List
          w={180}
          style={{
            flexShrink: 0,
            borderRight: "1px solid var(--kbrd-border-color)",
          }}
        >
          <Tabs.Tab value="geometry" leftSection={<MdStraighten size={16} />}>
            Geometry
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="geometry" p="lg" style={{ overflowY: "auto" }}>
          <Stack gap="md">
            <Title order={4}>Geometry</Title>
            <PropertyRow label="Unit (1U)">
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
            </PropertyRow>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}
