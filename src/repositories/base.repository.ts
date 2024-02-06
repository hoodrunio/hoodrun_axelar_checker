import { IBaseInterface } from "@database/base/model.interface";
import { FilterQuery, Model, Document, UpdateQuery } from "mongoose";

type TDoc<T> = Document & T;
type CRUDDoc<T> = Omit<T, keyof IBaseInterface>;

class BaseRepository<T extends IBaseInterface> {
  private _model: Model<TDoc<T>>;

  constructor(model: Model<TDoc<T>>) {
    this._model = model;
  }

  getModel(): Model<TDoc<T>> {
    return this._model;
  }

  async create(data: CRUDDoc<T>): Promise<TDoc<T>> {
    return await this._model.create({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async findAll(query?: FilterQuery<T>): Promise<T[]> {
    const { sort, ...filter } = query ?? { sort: {} };
    return await this._model
      .find(filter as FilterQuery<TDoc<T>>)
      .sort(sort)
      .exec();
  }

  async findById(id: string): Promise<TDoc<T> | null> {
    return await this._model.findById(id).exec();
  }

  async findOne(query?: FilterQuery<T>): Promise<TDoc<T> | null> {
    return await this._model.findOne(query).exec();
  }

  async updateOne(
    data: Partial<CRUDDoc<T>>,
    query?: FilterQuery<T>
  ): Promise<TDoc<T> | null> {
    return await this._model
      .findOneAndUpdate(query, data as UpdateQuery<TDoc<T>>, {
        new: true,
        upsert: true,
      })
      .exec();
  }

  async updateById(
    id: string | null,
    data: Partial<CRUDDoc<T>>
  ): Promise<TDoc<T> | null> {
    return await this._model
      .findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true })
      .exec();
  }

  async upsertById(
    id: string | null,
    data: Partial<CRUDDoc<T>>
  ): Promise<TDoc<T> | null> {
    return await this._model
      .findByIdAndUpdate(
        id,
        { ...data, updatedAt: new Date() },
        { new: true, upsert: true }
      )
      .exec();
  }

  async deleteById(id: string): Promise<TDoc<T> | null> {
    return await this._model
      .findByIdAndUpdate(id, { updatedAt: new Date() }, { new: true })
      .exec();
  }
}

export default BaseRepository;
