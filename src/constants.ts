export const SALES_OFFICERS = [
  { name: "Sumit Das", id: "136425", photo: "" },
  { name: "Priyas Malakar", id: "111978", photo: "" },
  { name: "Fazlur Rahman", id: "078211", photo: "" },
  { name: "Ridoy Ahmed", id: "169123", photo: "" },
  { name: "Promit Das", id: "175441", photo: "" },
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
