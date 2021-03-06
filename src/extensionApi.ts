import { ServerInfo } from './server';
import { ServersViewTreeDataProvider } from './serverExplorer';
import * as vscode from 'vscode';
import { Protocol, RSPClient, ServerState } from 'rsp-client';

export interface ExtensionAPI {
    readonly serverInfo: ServerInfo;
}

export class CommandHandler {

    private client: RSPClient;
    private serversData: ServersViewTreeDataProvider;

    constructor(serversData: ServersViewTreeDataProvider, client: RSPClient) {
        this.client = client;
        this.serversData = serversData;
    }

    async startServer(mode: string, context?: Protocol.ServerState): Promise<Protocol.StartServerResponse> {
        let selectedServerType: Protocol.ServerType;
        let selectedServerId: string;

        if (context === undefined) {
            selectedServerId = await vscode.window.showQuickPick(Array.from(this.serversData.serverStatus.keys()),
                { placeHolder: 'Select runtime/server to start' });
            selectedServerType = this.serversData.serverStatus.get(selectedServerId).server.type;
        } else {
            selectedServerType = context.server.type;
            selectedServerId = context.server.id;
        }

        const serverState = this.serversData.serverStatus.get(selectedServerId).state;
        if (serverState === ServerState.STOPPED || serverState === ServerState.UNKNOWN) {
            const response = await this.client.startServerAsync({
                params: {
                    serverType: selectedServerType.id,
                    id: selectedServerId,
                    attributes: new Map<string, any>()
                },
                mode: mode
            });
            if (response.status.severity > 0) {
                return Promise.reject(response.status.message);
            }
            return response;
        } else {
            return Promise.reject('The server is already running.');
        }
    }

    async stopServer(context?: Protocol.ServerState): Promise<Protocol.Status> {
        let serverId: string;
        if (context === undefined) {
            serverId = await vscode.window.showQuickPick(Array.from(this.serversData.serverStatus.keys()),
                { placeHolder: 'Select runtime/server to stop' });
        } else {
            serverId = context.server.id;
        }

        const stateObj: Protocol.ServerState = this.serversData.serverStatus.get(serverId);
        if (stateObj.state === ServerState.STARTED) {
            const status = await this.client.stopServerAsync({ id: serverId, force: true });
            if (status.severity > 0) {
                return Promise.reject(status.message);
            }
            return status;
        } else {
            return Promise.reject('The server is already stopped.');
        }
    }

    async removeServer(context?: Protocol.ServerState): Promise<Protocol.Status> {
        let serverId: string;
        let selectedServerType: Protocol.ServerType;
        if (context === undefined) {
            serverId = await vscode.window.showQuickPick(Array.from(this.serversData.serverStatus.keys()),
                { placeHolder: 'Select runtime/server to remove' });
            selectedServerType = this.serversData.serverStatus.get(serverId).server.type;
        } else {
            serverId = context.server.id;
            selectedServerType = context.server.type;
        }

        const status1: Protocol.ServerState = this.serversData.serverStatus.get(serverId);
        if (status1.state === ServerState.STOPPED) {
            const status = await this.client.deleteServerAsync({ id: serverId, type: selectedServerType });
            if (status.severity > 0) {
                return Promise.reject(status.message);
            }
            return status;
        } else {
            return Promise.reject('Please stop the server before removing it.');
        }
    }

    async showServerOutput(context?: Protocol.ServerState): Promise<void> {
        if (context === undefined) {
            const serverId = await vscode.window.showQuickPick(Array.from(this.serversData.serverStatus.keys()),
                { placeHolder: 'Select runtime/server to show ouput channel' });
            context = this.serversData.serverStatus.get(serverId);
        }
        this.serversData.showOutput(context);
    }

    async restartServer(context?: Protocol.ServerState): Promise<void> {
        if (context === undefined) {
            const serverId: string = await vscode.window.showQuickPick(
                Array.from(this.serversData.serverStatus.keys())
                .filter(item => this.serversData.serverStatus.get(item).state === ServerState.STARTED),
                { placeHolder: 'Select runtime/server to restart' }
            );
            context = this.serversData.serverStatus.get(serverId);
        }

        const params: Protocol.LaunchParameters = {
            mode: 'run',
            params: {
                id: context.server.id,
                serverType: context.server.type.id,
                attributes: new Map<string, any>()
            }
        };

        await this.client.stopServerSync({ id: context.server.id, force: true });
        await this.client.startServerAsync(params);
    }

    async addDeployment(context?: Protocol.ServerState): Promise<Protocol.Status> {
        let serverId: string;
        if (context === undefined) {
            return Promise.reject('Please select a server from the Servers view.');
        } else {
            serverId = context.server.id;
        }

        if (this.serversData) {
            const serverHandle: Protocol.ServerHandle = this.serversData.serverStatus.get(serverId).server;
            return this.serversData.addDeployment(serverHandle);
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    async removeDeployment(context?: Protocol.DeployableState): Promise<Protocol.Status> {
        if (context === undefined) {
            return Promise.reject('Please select a deployment from the Servers view to run this action.');
        }

        const serverId: string = context.server.id;
        const deploymentId: string = context.reference.label;

        if (this.serversData) {
            const serverState: Protocol.ServerState = this.serversData.serverStatus.get(serverId);
            if (serverState === undefined) {
                return Promise.reject('Please select a deployment from the Servers view to run this action.');
            }
            const serverHandle: Protocol.ServerHandle = serverState.server;
            const states: Protocol.DeployableState[] = serverState.deployableStates;
            for (const entry of states) {
                if ( entry.reference.label === deploymentId) {
                    return this.serversData.removeDeployment(serverHandle, entry.reference);
                }
            }
            return Promise.reject('Cannot find deployment ' + deploymentId);
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    async fullPublishServer(context?: Protocol.ServerState): Promise<Protocol.Status> {
        let serverId: string;
        if (context === undefined) {
            return Promise.reject('Please select a server from the Servers view.');
        } else {
            serverId = context.server.id;
        }

        if (this.serversData) {
            const serverHandle: Protocol.ServerHandle = this.serversData.serverStatus.get(serverId).server;
            return this.serversData.publish(serverHandle, 2); // TODO use constant? Where is it?
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    async addLocation(): Promise<Protocol.Status> {
        if (this.serversData) {
            return this.serversData.addLocation();
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    async activate(): Promise<void> {
        this.client.onServerAdded(handle => {
            this.serversData.insertServer(handle);
        });

        this.client.onServerRemoved(handle => {
            this.serversData.removeServer(handle);
        });

        this.client.onServerStateChange(event => {
            this.serversData.updateServer(event);
        });

        this.client.onServerOutputAppended(event => {
            this.serversData.addServerOutput(event);
        });
    }
}
