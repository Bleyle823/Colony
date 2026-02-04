import { describe, expect, it } from 'bun:test';
import { ensPlugin } from '../../plugin-ens/src/index';
import { resolveEnsAction, reverseResolveEnsAction } from '../../plugin-ens/src/actions/resolve';
import { getEnsAvatarAction, getEnsTextAction } from '../../plugin-ens/src/actions/info';
import { setEnsTextAction, setEnsAddressAction, setEnsAvatarAction } from '../../plugin-ens/src/actions/manage';

describe('ENS Plugin', () => {
    it('should be defined', () => {
        expect(ensPlugin).toBeDefined();
    });

    it('should have the correct name', () => {
        expect(ensPlugin.name).toBe('ens');
    });

    it('should have the expected description', () => {
        expect(ensPlugin.description).toContain('Ethereum Name Service (ENS) integration');
    });

    it('should export the expected actions', () => {
        expect(ensPlugin.actions).toBeDefined();
        expect(ensPlugin.actions?.length).toBe(7);
        
        // Check if specific actions are present
        const actionNames = ensPlugin.actions?.map(a => a.name);
        expect(actionNames).toContain('RESOLVE_ENS');
        expect(actionNames).toContain('REVERSE_RESOLVE_ENS');
        expect(actionNames).toContain('GET_ENS_AVATAR');
        expect(actionNames).toContain('GET_ENS_TEXT');
        expect(actionNames).toContain('SET_ENS_TEXT');
        expect(actionNames).toContain('SET_ENS_ADDRESS');
        expect(actionNames).toContain('SET_ENS_AVATAR');
    });

    it('should export actions that match the imported action objects', () => {
        expect(ensPlugin.actions).toContain(resolveEnsAction);
        expect(ensPlugin.actions).toContain(reverseResolveEnsAction);
        expect(ensPlugin.actions).toContain(getEnsAvatarAction);
        expect(ensPlugin.actions).toContain(getEnsTextAction);
        expect(ensPlugin.actions).toContain(setEnsTextAction);
        expect(ensPlugin.actions).toContain(setEnsAddressAction);
        expect(ensPlugin.actions).toContain(setEnsAvatarAction);
    });
});
