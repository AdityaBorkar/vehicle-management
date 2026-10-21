# Cashfree RC — Field Coverage (Spec 04)

Every Cashfree Vehicle RC key maps to a `vehicles` column; anything unmapped is preserved in `rc_raw`.
Remainder rule: after extracting known fields, every leftover key lands verbatim in `rc_raw` — a future provider key rename can never silently vanish.

| Cashfree key(s) | `vehicles` column | Notes |
|---|---|---|
| `vehicle_manufacturer_name`, `manufacturer_name`, `maker`, `manufacturer`, `make`, `brand` (+ `vehicle` split) | `make` | Combined `vehicle` split on first space |
| `model`, `model_name`, `variant` (+ `vehicle` remainder) | `model` | |
| `reg_date`, `registration_date`, `regn_date`, `regndate`, `date_of_registration` | `registration_date` | `parseApiDate`, null on unparseable |
| `vehicle_colour`, `vehicle_color`, `color`, `colour` | `color` | |
| `rc_expiry_date`, `fitness_valid`, `fitness_upto`, `fitness_validity`, `fit_upto`, `fitness` | `fitness_valid_till` | |
| `fitness_number` | `fitness_number` | |
| `fitness_valid_from`, `fitness_from` | `fitness_valid_from` | |
| `type`, `fuel`, `fuel_type` | `fuel_type` (normalized) + `fuel_type_raw` (verbatim) | Raw preserved in dedicated column (stronger than `rc_raw`); keys are consumed so they do not duplicate into `rc_raw` |
| `vehicle_insurance_upto`, `insurance_valid`, `insurance_upto`, `insurance_validity`, `insurance_expiry`, `insurance` | `insurance_valid_till` | |
| `insurance_company` | `insurance_company` | |
| `insurance_policy_no`, `policy_no` | `insurance_policy_no` | |
| `insurance_valid_from`, `insurance_from` | `insurance_valid_from` | |
| `pucc_upto`, `puc_valid`, `puc_upto`, `pucc_validity`, `pollution_upto`, `emission_valid`, `puc` | `pollution_valid_till` | |
| `puc_number`, `pucc_number` | `puc_number` | |
| `chassis`, `chassis_number`, `chassis_no`, `vin` | `vin` | |
| `owner_name`, `owner` | `owner_name` | |
| `father_name`, `father` | `father_name` | |
| `present_address` | `present_address` | |
| `permanent_address` | `permanent_address` | |
| `mobile_number`, `mobile`, `phone` | `mobile_number` | |
| `vehicle_class`, `class` | `vehicle_class` | |
| `body_type` | `body_type` | |
| `manufacturer_model` | `manufacturer_model` | |
| `vehicle_manufacturing_month_year`, `manufacturing_month_year` | `manufacturing_month_year` (text) + `year` (parsed) | |
| `manufacture_year`, `mfg_year`, `year_of_manufacture`, `model_year`, `year` | `year` | `parseApiYear`, fallback to registration year |
| `seating_capacity`, `seating` | `seating_capacity` | |
| `cubic_capacity` | `cubic_capacity` | |
| `wheelbase` | `wheelbase` | |
| `unladen_weight`, `unladen_weight_kg` | `unladen_weight_kg` | Stored as text to avoid parse failures |
| `gross_vehicle_weight`, `gross_vehicle_weight_kg`, `gvw` | `gross_vehicle_weight_kg` | Stored as text |
| `rto_code`, `rto` | `rto_code` | |
| `rto_name` | `rto_name` | |
| `office_code` | `office_code` | |
| `registration_authority`, `registering_authority` | `registration_authority` | |
| `ownership_sr_no`, `ownership` | `ownership_sr_no` | |
| `ownership_type` | `ownership_type` | |
| `hypothecation` | `hypothecation` | |
| `hypothecated_to` | `hypothecated_to` | |
| `financer`, `financed_by` | `financer` | |
| `permit_number`, `permit_no` | `permit_number` | |
| `permit_valid_from`, `permit_from` | `permit_valid_from` | |
| `permit_valid_till`, `permit_upto`, `permit_validity` | `permit_valid_till` | |
| `permit_type` | `permit_type` | |
| `tax_valid_till`, `tax_upto`, `road_tax_paid_till` | `tax_valid_till` | |
| `emission_norms`, `fuel_norms`, `norms` | `emission_norms` | |
| `status`, `rc_status` | `rc_status` | |
| `verification_id`, `reference_id` | `verification_id` (+ `rc_provider="cashfree"`, `rc_fetched_at`) | |
| `sleeper_capacity`, `standing_capacity` | — → `rc_raw` | Not separate columns; preserved verbatim in `rc_raw` per remainder rule |
| any other key (e.g. `version`) | — → `rc_raw` | Full unmapped remainder, never dropped |

`external_api_calls`: `request` = `{ vehicle_number, verification_id }` exactly as sent;
`response` = complete provider `body` on success, complete error body on failure; rows append-only.
