import { useState } from "react";
import { Button, Group, Modal, NumberInput, Stack, Tabs, Text, Title } from "@mantine/core";
import { MdStraighten } from "react-icons/md";
import { PropertyRow } from "@kbrd/plugins/web";

const DEFAULT_UNIT_MM = 19.05;

type Props = {
  opened: boolean;
  onClose: () => void;
};

export default function SettingsModal({ opened, onClose }: Props) {
  const [tab, setTab] = useState<string | null>("geometry");
  const [savedUnit, setSavedUnit] = useState<number>(DEFAULT_UNIT_MM);
  const [unit, setUnit] = useState<number>(DEFAULT_UNIT_MM);

  // Reset the draft to the last saved value whenever the modal opens back up.
  const [wasOpened, setWasOpened] = useState(opened);
  if (opened !== wasOpened) {
    setWasOpened(opened);
    if (opened) setUnit(savedUnit);
  }

  function cancel() {
    setUnit(savedUnit);
    onClose();
  }

  function save() {
    setSavedUnit(unit);
    onClose();
  }

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

        <Tabs.Panel
          value="geometry"
          px="lg"
          pb="lg"
          pt={0}
          style={{ overflowY: "auto" }}
        >
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
