import { csvDownloadResponse } from "@/lib/csv";

export function GET() {
  const csv = [
    "title,department_name,location_name,business_unit_name,employment_type,experience_min,experience_max,description,skills,salary_min,salary_max,salary_currency,openings,priority,confidential,target_close_date,status",
    "Senior frontend developer,Tech,Kalamassery Office,,full_time,3,6,\"Work on the design system.\",react;typescript;tailwind,1200000,1800000,INR,1,false,false,2026-03-31,draft",
    "Content Writer,SEO,Kalamassery Office,,full_time,1,3,\"Long-form blog and editorial content.\",writing;seo,400000,700000,INR,1,false,true,,draft"
  ].join("\n");
  return csvDownloadResponse("jobs-template.csv", csv);
}
