import { api } from "./client";
import type { BoardData } from "../types/layout";

const BOARD_URL = "/api/board";

export const getBoard = () => api<BoardData>(BOARD_URL);

export const updateBoard = (payload: BoardData) =>
  api<BoardData>(BOARD_URL, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
