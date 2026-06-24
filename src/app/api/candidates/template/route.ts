import { csvDownloadResponse } from "@/lib/csv";

export function GET() {
  const csv = [
    "first_name,middle_name,last_name,email,phone,gender,date_of_birth,job_title,experience_years,experience_months,current_company,current_location,preferred_location,current_salary,expected_salary,source,linkedin_url,github_url,portfolio_url,skills",
    "Alfina,,L,alfinal.03@gmail.com,+91 9539573617,female,1999-04-22,Content Writer,4,0,Aldun,\"Pala, KL\",\"Pala, KL\",480000,650000,linkedin,https://linkedin.com/in/example,,,writing;seo;social media",
    "Mahir,,Ansari,mahir@example.com,+91 9074206900,male,1996-08-12,Sr. Sales Executive,3,0,Acme,Kozhikode,Kochi,520000,720000,linkedin,,,,sales;cold calling"
  ].join("\n");
  return csvDownloadResponse("candidates-template.csv", csv);
}
