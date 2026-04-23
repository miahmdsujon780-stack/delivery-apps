export const SALES_OFFICERS = [
  { name: "SUMIT", id: "1001", photo: "" },
  { name: "PRIYAS", id: "1002", photo: "" },
  { name: "FOZLUR", id: "1003", photo: "" },
  { name: "RIDOY", id: "1004", photo: "" },
  { name: "PROMIT", id: "1005", photo: "" },
];

export const ADMIN_EMAIL = "miahmdsujon780@gmail.com";

// Monthly targets per Sales Officer
export const MONTHLY_TARGETS = {
  tissue: 5000,
  ballpen: 2000,
  exbook: 1000
};

// Global targets (MonthlyTargets * Number of Officers)
export const GLOBAL_TARGETS = {
  tissue: MONTHLY_TARGETS.tissue * SALES_OFFICERS.length,
  ballpen: MONTHLY_TARGETS.ballpen * SALES_OFFICERS.length,
  exbook: MONTHLY_TARGETS.exbook * SALES_OFFICERS.length
};
