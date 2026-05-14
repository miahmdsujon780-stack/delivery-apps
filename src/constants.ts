export const PRODUCTS = [
  { name: "BOX", category: "Tissue" },
  { name: "WALLET", category: "Tissue" },
  { name: "NAPKIN P", category: "Tissue" },
  { name: "Nap restaurant", category: "Tissue" },
  { name: "T-WHAITE", category: "Tissue" },
  { name: "T-PINK", category: "Tissue" },
  { name: "T-GOLD", category: "Tissue" },
  { name: "H/T-150", category: "Tissue" },
  { name: "H/T-200", category: "Tissue" },
  { name: "H/T-250", category: "Tissue" },
  { name: "K/N", category: "Tissue" },
  { name: "Total tissue", category: "Tissue" },
  { name: "EXBOOK", category: "Stationery" },
  { name: "BALLPEN ( 5 Tk )", category: "Stationery" },
  { name: "BALLPEN ( 6-7 Tk )", category: "Stationery" },
  { name: "BALLPEN ( 10 Tk )", category: "Stationery" },
  { name: "STATIONERY", category: "Stationery" },
];

export const SALES_OFFICERS = [
  { name: "Sumit Das", id: "136425", photo: "" },
  { name: "Priyas Malakar", id: "111978", photo: "" },
  { name: "Fazlur Rahman", id: "078211", photo: "" },
  { name: "Ridoy Ahmed", id: "169123", photo: "" },
  { name: "Promit Das", id: "175441", photo: "" },
];

export const DEALERS = [
  { id: "1013278", name: "Mohona Distribution" },
  { id: "1031141", name: "D And D Enterprise" },
  { id: "1031102", name: "Ikbal Ahmed" },
  { id: "1008143", name: "Islam Brothers Store" },
];

export const ADMIN_EMAIL = "miahmdsujon780@gmail.com";

// Monthly targets per Sales Officer (in TK Value)
export const MONTHLY_TARGETS = {
  tissue: 150000,
  ballpen: 25000,
  exbook: 50000,
  stationery: 25000
};

// Global targets (MonthlyTargets * Number of Officers)
export const GLOBAL_TARGETS = {
  tissue: MONTHLY_TARGETS.tissue * SALES_OFFICERS.length,
  ballpen: MONTHLY_TARGETS.ballpen * SALES_OFFICERS.length,
  exbook: MONTHLY_TARGETS.exbook * SALES_OFFICERS.length,
  stationery: MONTHLY_TARGETS.stationery * SALES_OFFICERS.length
};
