
import { supabase } from "@/integrations/supabase/client";

export interface DevicePair {
  peer_code: string;
  device_name: string;
  network_id: string;
}

export async function saveDevicePair(deviceInfo: DevicePair) {
  const { error } = await supabase
    .from('active_devices')
    .upsert({
      peer_code: deviceInfo.peer_code,
      device_name: deviceInfo.device_name,
      network_id: deviceInfo.network_id,
    });

  if (error) throw error;
}

export async function getDevicePairs(): Promise<DevicePair[]> {
  const { data, error } = await supabase
    .from('active_devices')
    .select('*')
    .order('last_seen', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateDeviceLastSeen(peerCode: string) {
  const { error } = await supabase
    .from('active_devices')
    .update({ last_seen: new Date().toISOString() })
    .eq('peer_code', peerCode);

  if (error) throw error;
}
