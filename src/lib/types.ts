export type SquareStatus = "AVAILABLE" | "OWNED" | "LISTED";

export type SquareDetailData = {
  id: number;
  coordinateX: number;
  coordinateY: number;
  price: number;
  status: SquareStatus;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  externalUrl: string | null;
  backgroundColor: string | null;
  purchasedAt: string | null;
  owner: { username: string; avatarUrl: string | null } | null;
  activeListing: { id: string; price: number; createdAt: string } | null;
};
