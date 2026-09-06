import { Box, Menu, Text, UnstyledButton } from "@mantine/core";
import {
  MdAdd,
  MdCheck,
  MdDelete,
  MdEdit,
  MdKeyboardArrowDown,
} from "react-icons/md";

type Props = {
  states: string[];
  activeState: string;
  onSelect: (state: string) => void;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * The Properties tab's own state picker (Up/Down/…, see `Inspector`) —
 * same interaction pattern as the Layer picker (`menu/Layer`): an
 * unstyled target showing the current selection with a trailing chevron,
 * each option listed with a checkmark when selected, a divider, then
 * Add/Edit/Delete (Delete disabled once this is the only state left).
 * Unlike `menu/Layer`, this one owns no data of its own — every mutation
 * (adding/renaming/deleting a state) touches both the system properties
 * and every attached plugin at once, which only `Inspector`'s own
 * `useKeyInspector` has enough context to do.
 */
export default function State({
  states,
  activeState,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  return (
    <Menu shadow="md" width={200} position="bottom-end">
      <Menu.Target>
        <UnstyledButton
          style={{ display: "flex", alignItems: "center", gap: 4 }}
        >
          <Text size="xs">{activeState}</Text>
          <MdKeyboardArrowDown size={16} />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {states.map((state) => (
          <Menu.Item
            key={state}
            leftSection={
              state === activeState ? <MdCheck size={16} /> : <Box w={16} />
            }
            onClick={() => onSelect(state)}
          >
            {state}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item leftSection={<MdAdd size={16} />} onClick={onAdd}>
          Add
        </Menu.Item>
        <Menu.Item leftSection={<MdEdit size={16} />} onClick={onEdit}>
          Edit
        </Menu.Item>
        <Menu.Item
          leftSection={<MdDelete size={16} />}
          color="red"
          disabled={states.length <= 1}
          onClick={onDelete}
        >
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
