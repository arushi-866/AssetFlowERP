import { AssetRepository, AssetInput } from '../repositories/asset.repository';
import { LogRepository } from '../repositories/log.repository';
import { DepartmentRepository } from '../repositories/department.repository';
import { broadcast } from '../websocket/server';

export class AssetService {
  static async register(managerId: string, data: Omit<AssetInput, 'assetTag'>) {
    // 1. Verify category exists
    const category = await DepartmentRepository.findCategoryById(data.categoryId);
    if (!category) {
      throw { status: 400, message: 'Asset Category does not exist' };
    }

    // 1b. Verify location exists in locations database table
    const locationExists = await DepartmentRepository.findLocationByName(data.location);
    if (!locationExists) {
      throw { status: 400, message: `Location "${data.location}" is not a valid organization location` };
    }

    // 2. Auto-generate next asset tag
    const nextTag = await AssetRepository.getNextAssetTag();

    // 3. Register asset
    const newAsset = await AssetRepository.create({
      ...data,
      assetTag: nextTag,
    });

    // 4. Log the registration
    await LogRepository.create({
      userId: managerId,
      action: 'REGISTER_ASSET',
      targetTable: 'assets',
      targetId: newAsset.id,
      newValues: newAsset,
    });

    // 5. Broadcast to update dashboard KPIs
    broadcast('KPI_UPDATE', { source: 'REGISTER_ASSET' });

    return newAsset;
  }

  static async findById(id: string) {
    const asset = await AssetRepository.findById(id);
    if (!asset) {
      throw { status: 404, message: 'Asset not found' };
    }
    return asset;
  }

  static async search(filters: {
    query?: string;
    category?: string;
    status?: string;
    departmentId?: string;
    location?: string;
  }) {
    return AssetRepository.search(filters);
  }

  static async getAssetDetailWithHistory(id: string) {
    const asset = await AssetRepository.findById(id);
    if (!asset) {
      throw { status: 404, message: 'Asset not found' };
    }
    const history = await AssetRepository.getHistory(id);
    return {
      ...asset,
      history,
    };
  }
}
