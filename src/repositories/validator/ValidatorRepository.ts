import {
  IValidator,
  IValidatorDocument,
  ValRpcHealthEndpoint,
} from "@database/models/validator/validator.interface";
import ValidatorDbModel from "@database/models/validator/validator.model";
import BaseRepository from "@repositories/base.repository";
import { FilterQuery } from "mongoose";

export class ValidatorRepository extends BaseRepository<
  IValidator,
  IValidatorDocument
> {
  constructor() {
    super(ValidatorDbModel);
  }

  async activeValidators(): Promise<IValidator[]> {
    return this.findAll({ is_active: true });
  }

  async isOperatorExist(operatorAddress: string): Promise<boolean> {
    const validator = await this.findOne({
      operator_address: operatorAddress.toLowerCase(),
    });

    return !!validator;
  }

  async updateValidatorSupportedEvmChains(
    operatorAddress: string,
    supportedEvmChains: string[]
  ): Promise<IValidatorDocument> {
    const updatedValidator = await this.updateOne(
      { operator_address: operatorAddress },
      {
        supported_evm_chains: supportedEvmChains,
      }
    );
    return updatedValidator as IValidatorDocument;
  }

  async upsertRpcHealthEndpoint(
    query: FilterQuery<IValidatorDocument>,
    rpcHealthEndpoint: ValRpcHealthEndpoint
  ): Promise<IValidatorDocument | null> {
    const validator = await this.findOne(query);
    if (!validator) return null;

    // Ensure rpcHealthEndpoints array exists
    validator.rpc_health_endpoints = validator.rpc_health_endpoints || [];

    // Check if the rpcHealthEndpoint already exists in the array
    const existingEndpointIndex = validator.rpc_health_endpoints.findIndex(
      (endpoint) => endpoint.name == rpcHealthEndpoint.name
    );

    // If the endpoint already exists, update it
    if (existingEndpointIndex !== -1) {
      const existingEndpoint =
        validator.rpc_health_endpoints[existingEndpointIndex];
      validator.rpc_health_endpoints[existingEndpointIndex] = rpcHealthEndpoint;
    } else {
      // Otherwise, push the new rpcHealthEndpoint into the array
      validator.rpc_health_endpoints.push(rpcHealthEndpoint);
    }

    await validator.save();
    return validator;
  }

  async removeRpcHealthEndpoint(
    query: FilterQuery<IValidatorDocument>,
    rpcHealthEndpointName: string
  ): Promise<IValidatorDocument | null> {
    const validator = await this.findOne(query);
    if (!validator) return null;

    validator.rpc_health_endpoints = validator?.rpc_health_endpoints ?? [];

    // Remove the rpcHealthEndpoint with the specified name
    validator.rpc_health_endpoints = validator.rpc_health_endpoints.filter(
      (endpoint) => endpoint.name !== rpcHealthEndpointName
    );
    await validator.save();
    return validator;
  }

  async getRpcHealthEndpointWithName(
    query: FilterQuery<IValidatorDocument>,
    rpcHealthEndpointName: string
  ): Promise<ValRpcHealthEndpoint | null> {
    const validator = await this.findOne(query);
    if (!validator || !validator.rpc_health_endpoints) return null;

    // Find the rpcHealthEndpoint by name
    const endpoint = validator.rpc_health_endpoints.find(
      (endpoint) => endpoint.name === rpcHealthEndpointName
    );

    return endpoint || null;
  }

  async upsertOne(
    filter: FilterQuery<IValidatorDocument>,
    data: Partial<IValidator>
  ): Promise<IValidatorDocument | null> {
    // Create a new object to avoid modifying the input
    const updateData = { ...data };

    // Ensure verifier_addresses is a flat array of strings
    if (updateData.verifier_addresses !== undefined) {
      try {
        let addresses: string[];
        
        if (Array.isArray(updateData.verifier_addresses)) {
          // If it's already an array, map each element to ensure they're strings
          addresses = updateData.verifier_addresses.map(addr => String(addr));
        } else if (typeof updateData.verifier_addresses === 'string') {
          // If it's a string, try to parse it
          const parsed = JSON.parse(updateData.verifier_addresses);
          addresses = Array.isArray(parsed) ? parsed.map(addr => String(addr)) : [];
        } else {
          addresses = [];
        }

        // Assign the cleaned array back to the update data
        updateData.verifier_addresses = addresses;
      } catch (error) {
        console.error('Error processing verifier addresses:', error);
        updateData.verifier_addresses = [];
      }
    }

    return super.upsertOne(filter, updateData);
  }
}
