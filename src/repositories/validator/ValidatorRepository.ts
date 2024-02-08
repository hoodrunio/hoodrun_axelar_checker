import {
  IValidator,
  IValidatorDocument,
} from "@database/models/validator/validator.interface";
import ValidatorDbModel from "@database/models/validator/validator.model";
import BaseRepository from "@repositories/base.repository";

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
}
