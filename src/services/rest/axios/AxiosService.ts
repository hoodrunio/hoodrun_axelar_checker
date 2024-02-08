import { logger } from "@utils/logger";
import axios, { AxiosInstance, AxiosResponse, Method } from "axios";
import axiosRetry, { isNetworkOrIdempotentRequestError } from "axios-retry";

const AXIOS_REQ_RETRY_COUNT = 3;

export class AxiosService {
  axiosInstance: AxiosInstance;

  constructor(params: AxiosServiceParams) {
    const { baseUrl, prefix = "" } = params;

    this.axiosInstance = axios.create({
      baseURL: `${baseUrl}${prefix}`,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setRetryMechanism(AXIOS_REQ_RETRY_COUNT);
    this.setInterceptors();
  }

  async request<R>(params: AxiosRequestParams): Promise<AxiosResponse<R, any>> {
    const { method, url, body, params: queryParams, rest } = params;

    try {
      const axiosResponse = await this.axiosInstance<R>({
        method,
        url,
        data: body,
        params: queryParams,
        ...rest,
      });
      return axiosResponse;
    } catch (error) {
      logger.error(`Axios Service Request to ${url} failed: ${error}`);
      throw error;
    }
  }

  private setRetryMechanism(retryCount: number) {
    axiosRetry(this.axiosInstance, {
      retries: retryCount,
      retryCondition: isNetworkOrIdempotentRequestError,
    });
  }

  private setInterceptors() {
    this.axiosInstance.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }
}

interface AxiosServiceParams {
  baseUrl: string;
  prefix?: string;
}

type IBody = Record<string, unknown> | string | null;
interface AxiosRequestParams {
  method: Method;
  url: string;
  body?: IBody;
  params?: any;
  rest?: any;
}
