import api from './api';

const API_URL = '/system';

export interface BackupInfo {
    filename: string;
    size_mb: number;
    created_at: string;
}

export interface RestoreTask {
    id: string;
    filename: string;
    status: 'pending' | 'extracting' | 'importing' | 'indexing' | 'merging' | 'completed' | 'failed' | string;
    progress: number;
    summary: string | null;
    start_time: string;
    end_time: string | null;
    error: string | null;
}

export interface RestoreRequest {
    filename: string;
    target_tables: string[];
    activity_ids?: string[];
    work_packages?: string[];
    all_data: boolean;
}

export interface DiagnosticsInfo {
    db_pool?: string;
    db_pool_error?: string;
    mysql_connections?: number;
    mysql_max_connections?: number;
    mysql_error?: string;
}

export interface HeavyOpStatus {
    import?: { current: number; max: number };
    export?: { current: number; max: number };
    heavy_query?: { current: number; max: number };
}

export const systemService = {
    getBackups: async (): Promise<BackupInfo[]> => {
        const response = await api.get(`${API_URL}/backups`);
        return response.data;
    },

    getTasks: async (): Promise<RestoreTask[]> => {
        const response = await api.get(`${API_URL}/tasks`);
        return response.data;
    },

    getDiagnostics: async (): Promise<DiagnosticsInfo> => {
        const response = await api.get(`${API_URL}/diagnostics`);
        return response.data;
    },

    getHeavyOpStatus: async (): Promise<HeavyOpStatus> => {
        const response = await api.get(`${API_URL}/heavy-op-status`);
        return response.data;
    },

    restoreData: async (request: RestoreRequest): Promise<{ message: string, task_id: string }> => {
        const response = await api.post(`${API_URL}/restore`, request);
        return response.data;
    }
};
