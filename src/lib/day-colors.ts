/** One colour per day, shared by the map markers, route lines and day headers. */
const DAY_COLORS = ["#15795a", "#b5573a", "#35506a", "#a8741a", "#6a3d5a", "#2e7d74", "#8f3f28"];

export const dayColor = (index: number) => DAY_COLORS[index % DAY_COLORS.length];
