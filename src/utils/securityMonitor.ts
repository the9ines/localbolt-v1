
import { version as reactVersion } from 'react';
import packageJson from '../../package.json';

interface SecurityCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

interface DependencyInfo {
  name: string;
  currentVersion: string;
  latestVersion?: string;
  needsUpdate: boolean;
}

export class SecurityMonitor {
  private static instance: SecurityMonitor;
  
  private constructor() {}

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  async checkDependencies(): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    
    // Check React version
    dependencies.push({
      name: 'react',
      currentVersion: reactVersion,
      needsUpdate: false, // Would need to fetch from npm registry to determine
    });

    return dependencies;
  }

  async performSecurityChecks(): Promise<SecurityCheck[]> {
    const checks: SecurityCheck[] = [];

    // Check HTTPS
    checks.push({
      name: 'HTTPS Check',
      status: window.location.protocol === 'https:' ? 'pass' : 'warn',
      message: window.location.protocol === 'https:' 
        ? 'Connection is secure' 
        : 'Connection is not using HTTPS'
    });

    // Check for outdated browser features
    checks.push({
      name: 'Modern Browser Features',
      status: this.checkModernBrowserFeatures() ? 'pass' : 'warn',
      message: this.checkModernBrowserFeatures() 
        ? 'Browser supports modern security features' 
        : 'Browser may be outdated'
    });

    // Content Security Policy Check
    checks.push({
      name: 'Content Security Policy',
      status: this.checkCSP() ? 'pass' : 'warn',
      message: this.checkCSP() 
        ? 'CSP is enabled' 
        : 'No Content Security Policy detected'
    });

    return checks;
  }

  private checkModernBrowserFeatures(): boolean {
    return !!(
      window.crypto &&
      window.crypto.subtle &&
      window.fetch &&
      window.TextEncoder
    );
  }

  private checkCSP(): boolean {
    const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return !!metaCSP || !!document.querySelector('meta[content*="content-security-policy"]');
  }

  async logSecurityReport(): Promise<void> {
    console.group('Security Status Report');
    
    const checks = await this.performSecurityChecks();
    const dependencies = await this.checkDependencies();
    
    console.log('Security Checks:');
    checks.forEach(check => {
      console.log(
        `${check.name}: ${check.status.toUpperCase()}\n${check.message}`
      );
    });
    
    console.log('\nDependency Status:');
    dependencies.forEach(dep => {
      console.log(
        `${dep.name}: ${dep.currentVersion}`
      );
    });
    
    console.groupEnd();
  }
}

// Run security checks periodically
export const initializeSecurityMonitoring = (intervalMinutes: number = 60) => {
  const monitor = SecurityMonitor.getInstance();
  
  // Initial check
  monitor.logSecurityReport();
  
  // Schedule periodic checks
  setInterval(() => {
    monitor.logSecurityReport();
  }, intervalMinutes * 60 * 1000);
};
