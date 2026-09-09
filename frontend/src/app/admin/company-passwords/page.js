"use client";

import CompanyPasswordsBoard from "../../Shared/CompanyPasswordsBoard";

// The board itself lives in Shared/CompanyPasswordsBoard so add / edit / delete
// behave the same in every staff portal.
export default function AdminCompanyPasswords() {
  return <CompanyPasswordsBoard />;
}
