import { Pagination } from "@/services/rest/interfaces/pagination";
import { Validator } from "mongoose";

export interface ValidatorsGetResponse {
  validators: Validator[];
  pagination: Pagination;
}
