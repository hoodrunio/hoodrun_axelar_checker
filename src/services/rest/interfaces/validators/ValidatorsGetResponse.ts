import { Pagination } from "@/services/rest/interfaces/pagination";
import { Validator } from "@/services/rest/interfaces/validators/validator";

export interface ValidatorsGetResponse {
  validators: Validator[];
  pagination: Pagination;
}
