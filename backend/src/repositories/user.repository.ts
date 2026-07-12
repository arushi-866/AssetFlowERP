import { query } from '../config/db';
import { PoolClient } from 'pg';

export interface UserInput {
  name: string;
  email: string;
  passwordHash: string;
  roleId: string;
  departmentId?: string | null;
}

export class UserRepository {
  static async findByEmail(email: string) {
    const sql = `
      SELECT u.*, r.name as role_name, d.name as department_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.email = $1
    `;
    const res = await query(sql, [email]);
    return res.rows[0] || null;
  }

  static async findById(id: string) {
    const sql = `
      SELECT u.*, r.name as role_name, d.name as department_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = $1
    `;
    const res = await query(sql, [id]);
    return res.rows[0] || null;
  }

  static async findRoleByName(roleName: string) {
    const sql = `SELECT * FROM roles WHERE name = $1`;
    const res = await query(sql, [roleName]);
    return res.rows[0] || null;
  }

  static async create(user: UserInput) {
    const sql = `
      INSERT INTO users (name, email, password_hash, role_id, department_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, role_id, department_id, status, created_at
    `;
    const params = [user.name, user.email, user.passwordHash, user.roleId, user.departmentId || null];
    const res = await query(sql, params);
    return res.rows[0];
  }

  static async updateRole(userId: string, roleId: string, client?: PoolClient) {
    const sql = `
      UPDATE users
      SET role_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const res = client 
      ? await client.query(sql, [roleId, userId])
      : await query(sql, [roleId, userId]);
    return res.rows[0];
  }

  static async updateDepartment(userId: string, departmentId: string | null, client?: PoolClient) {
    const sql = `
      UPDATE users
      SET department_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const res = client 
      ? await client.query(sql, [departmentId, userId])
      : await query(sql, [departmentId, userId]);
    return res.rows[0];
  }

  static async updatePassword(userId: string, passwordHash: string, client?: PoolClient) {
    const sql = `
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const res = client 
      ? await client.query(sql, [passwordHash, userId])
      : await query(sql, [passwordHash, userId]);
    return res.rows[0];
  }

  static async findAll() {
    const sql = `
      SELECT u.id, u.name, u.email, u.status, u.created_at,
             r.name as role_name, d.name as department_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.name ASC
    `;
    const res = await query(sql);
    return res.rows;
  }
}
