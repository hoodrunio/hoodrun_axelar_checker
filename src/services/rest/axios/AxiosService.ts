import { logger } from "@utils/logger";
import axios, {
  AxiosHeaders,
  AxiosInstance,
  AxiosResponse,
  Method,
  RawAxiosRequestHeaders,
} from "axios";
import axiosRetry, { isNetworkOrIdempotentRequestError } from "axios-retry";

const AXIOS_REQ_RETRY_COUNT = 3;

export class AxiosService {
  axiosInstances: AxiosInstance[];

  constructor(params: AxiosServiceParams) {
    const { baseUrls, prefix = "" } = params;

    this.axiosInstances = baseUrls.map((baseUrl: string) => {
      const instance = axios.create({
        baseURL: `${baseUrl}${prefix}`,
        headers: {
          "Content-Type": "application/json",
        },
      });

      this.setRetryMechanism(instance, AXIOS_REQ_RETRY_COUNT);
      this.setInterceptors(instance);

      return instance;
    });
  }

  async request<R>(params: AxiosRequestParams): Promise<AxiosResponse<R, any>> {
    const { method, url, body, params: queryParams, rest, headers } = params;

    for (const instance of this.axiosInstances) {
      try {
        const axiosResponse = await instance<R>({
          method,
          url,
          data: body,
          params: queryParams,
          headers,
          ...rest,
        });
        return axiosResponse;
      } catch (error) {
        logger.error(
          `Axios Service Request to ${instance.getUri()}${url} failed: ${error}`
        );
      }
    }

    throw new Error("All instances requests failed");
  }

  private setRetryMechanism(instance: AxiosInstance, retryCount: number) {
    axiosRetry(instance, {
      retries: retryCount,
      retryCondition: isNetworkOrIdempotentRequestError,
    });
  }

  private setInterceptors(instance: AxiosInstance) {
    instance.interceptors.response.use(
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
  baseUrls: string[];
  prefix?: string;
}

type IBody = Record<string, unknown> | string | null;
interface AxiosRequestParams {
  method: Method;
  url: string;
  body?: IBody;
  params?: any;
  rest?: any;
  headers?: RawAxiosRequestHeaders | AxiosHeaders;
}
