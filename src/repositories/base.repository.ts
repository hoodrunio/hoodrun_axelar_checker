import { IBaseInterface } from "@database/base/model.interface";
import { FilterQuery, Model, Document, UpdateQuery } from "mongoose";

type CRUDDoc<T> = Omit<T, keyof IBaseInterface>;

class BaseRepository<T extends IBaseInterface, TD extends T & Document> {
  private _model: Model<TD>;

  constructor(model: Model<TD>) {
    this._model = model;
  }

  getModel(): Model<TD> {
    return this._model;
  }

  async create(data: CRUDDoc<T>): Promise<TD> {
    return await this._model.create({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async findAll(query?: FilterQuery<T>): Promise<TD[]> {
    const { sort, limit, ...filter } = query ?? { sort: {} };
    let findQuery = this._model.find(filter as FilterQuery<TD>).sort(sort);

    if (limit) {
      findQuery = findQuery.limit(limit);
    }

    return await findQuery.exec();
  }

  async findById(id: string): Promise<TD | null> {
    return await this._model.findById(id).exec();
  }

  async findOne(query?: FilterQuery<T>): Promise<TD | null> {
    return await this._model.findOne(query).exec();
  }

  async upsertOne(
    query: FilterQuery<T>,
    data: Partial<CRUDDoc<T>>
  ): Promise<TD | null> {
    return await this._model
      .findOneAndUpdate(query, data as UpdateQuery<TD>, {
        new: true,
        upsert: true,
      })
      .exec();
  }

  async updateOne(
    query: FilterQuery<T>,
    data: Partial<CRUDDoc<T>>
  ): Promise<TD | null> {
    return await this._model
      .findOneAndUpdate(
        query,
        { ...data, updatedAt: new Date() },
        { new: true }
      )
      .exec();
  }

  async updateById(
    id: string | null,
    data: Partial<CRUDDoc<T>>
  ): Promise<TD | null> {
    return await this._model
      .findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true })
      .exec();
  }

  async deleteById(id: string): Promise<TD | null> {
    return await this._model
      .findByIdAndUpdate(id, { updatedAt: new Date() }, { new: true })
      .exec();
  }
}

export default BaseRepository;
