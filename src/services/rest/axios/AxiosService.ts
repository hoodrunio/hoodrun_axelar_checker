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
const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests

export class AxiosService {
  axiosInstances: AxiosInstance[];
  private lastRequestTime: number = 0;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;

  constructor(params: AxiosServiceParams) {
    const { baseUrls, prefix = "" } = params;

    this.axiosInstances = baseUrls.map((baseUrl: string) => {
      const instance = axios.create({
        baseURL: baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl + (prefix || ''),
        headers: {
          "Content-Type": "application/json",
        },
      });

      this.setRetryMechanism(instance, AXIOS_REQ_RETRY_COUNT);
      this.setInterceptors(instance);

      return instance;
    });
  }

  private async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        try {
          // Ensure minimum delay between requests
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
          }
          this.lastRequestTime = Date.now();

          await request();
        } catch (error) {
          logger.error(`Error processing queued request: ${error}`);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  async request<R>(params: AxiosRequestParams): Promise<AxiosResponse<R, any>> {
    return new Promise((resolve, reject) => {
      const makeRequest = async () => {
        const { method, url, body, params: queryParams, rest, headers } = params;
        let lastError: Error | null = null;

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
            resolve(axiosResponse);
            return;
          } catch (error: any) {
            lastError = error;
            if (error?.response?.status === 429) {
              // If rate limited, requeue the request
              this.requestQueue.push(makeRequest);
              this.processQueue();
              return;
            }
            logger.error(
              `Axios Service Request to ${instance.getUri()}${url} failed: ${error}`
            );
          }
        }

        reject(lastError || new Error("All instances requests failed"));
      };

      this.requestQueue.push(makeRequest);
      this.processQueue();
    });
  }

  private setRetryMechanism(instance: AxiosInstance, retryCount: number) {
    axiosRetry(instance, {
      retries: retryCount,
      retryCondition: (error) => {
        // Don't retry on rate limits - we handle those separately
        if (error?.response?.status === 429) return false;
        return isNetworkOrIdempotentRequestError(error);
      },
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
