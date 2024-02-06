import { Pagination } from "../pagination";
import { Validator } from "./validator";

export interface ValidatorsGetResponse {
  validators: Validator[];
  pagination: Pagination;
}
