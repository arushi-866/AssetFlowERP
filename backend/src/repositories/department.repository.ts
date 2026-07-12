import { query } from '../config/db';
import { PoolClient } from 'pg';

export interface DepartmentInput {
  name: string;
  headId?: string | null;
  parentDepartmentId?: string | null;
  status?: string;
}

export interface CategoryInput {
  name: string;
  customFields?: any;
}

export class DepartmentRepository {
  // Departments
  static async createDepartment(dept: DepartmentInput) {
    const sql = `
      INSERT INTO departments (name, head_id, parent_department_id, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const params = [dept.name, dept.headId || null, dept.parentDepartmentId || null, dept.status || 'ACTIVE'];
    const res = await query(sql, params);
    return res.rows[0];
  }

  static async findDepartmentById(id: string) {
    const sql = `SELECT * FROM departments WHERE id = $1`;
    const res = await query(sql, [id]);
    return res.rows[0] || null;
  }

  static async updateDepartment(id: string, dept: DepartmentInput, client?: PoolClient) {
    const sql = `
      UPDATE departments
      SET name = $1, head_id = $2, parent_department_id = $3, status = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;
    const params = [dept.name, dept.headId || null, dept.parentDepartmentId || null, dept.status || 'ACTIVE', id];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0];
  }

  static async findAllDepartments() {
    const sql = `
      SELECT d.*, 
             u.name as head_name, u.email as head_email,
             p.name as parent_department_name
      FROM departments d
      LEFT JOIN users u ON d.head_id = u.id
      LEFT JOIN departments p ON d.parent_department_id = p.id
      ORDER BY d.name ASC
    `;
    const res = await query(sql);
    return res.rows;
  }

  // Categories
  static async createCategory(cat: CategoryInput) {
    const sql = `
      INSERT INTO asset_categories (name, custom_fields)
      VALUES ($1, $2)
      RETURNING *
    `;
    const params = [cat.name, JSON.stringify(cat.customFields || {})];
    const res = await query(sql, params);
    return res.rows[0];
  }

  static async findCategoryById(id: string) {
    const sql = `SELECT * FROM asset_categories WHERE id = $1`;
    const res = await query(sql, [id]);
    return res.rows[0] || null;
  }

  static async updateCategory(id: string, name: string, customFields: any) {
    const sql = `
      UPDATE asset_categories
      SET name = $1, custom_fields = $2
      WHERE id = $3
      RETURNING *
    `;
    const res = await query(sql, [name, JSON.stringify(customFields), id]);
    return res.rows[0];
  }

  static async findAllCategories() {
    const sql = `SELECT * FROM asset_categories ORDER BY name ASC`;
    const res = await query(sql);
    return res.rows;
  }

  // Locations
  static async findAllLocations() {
    const sql = `SELECT * FROM locations ORDER BY name ASC`;
    const res = await query(sql);
    return res.rows;
  }

  static async findLocationByName(name: string) {
    const sql = `SELECT * FROM locations WHERE name = $1`;
    const res = await query(sql, [name]);
    return res.rows[0] || null;
  }
}
